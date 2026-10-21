import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Role, VideoStatus } from '@prisma/client';
import { storageKeys } from '@video-streaming/shared';
import { StorageService } from '../../../shared/infrastructure/storage/storage.service';
import { QueueService } from '../../../shared/infrastructure/queue/queue.service';
import { AppError } from '../../../shared/kernel/errors';
import { Paginated } from '../../../shared/kernel/envelope';
import { logger } from '../../../shared/infrastructure/logger/logger';
import { issueStreamToken } from '../../../shared/kernel/stream-token';
import { loadConfig } from '../../../config';
import type { AuthenticatedUser } from '../../auth/application/auth.service';
import { VideoRepository, type VideoWithMedia } from '../infrastructure/video.repository';
import {
  assertAllowedExtension,
  assertAllowedMimeType,
  assertLooksLikeVideo,
} from '../domain/upload-policy';
import type { ListVideosQuery, UpdateVideoInput, UploadMetadata } from '../presentation/dtos';

export type VideoView = {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
  playbackUrl: string | null;
  posterUrl: string | null;
  /** iframe URL for embedding elsewhere. Null unless the video is public. */
  embedUrl: string | null;
  resolutions: { resolution: string; url: string; width: number; height: number; bitrate: number }[];
};

export type UploadSource = {
  filename: string;
  mimeType: string;
  /** Upper bound on the payload size, from the request's Content-Length. */
  declaredBytes: number;
  stream: Readable;
};

@Injectable()
export class VideoService {
  constructor(
    private readonly repo: VideoRepository,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  async list(actor: AuthenticatedUser, query: ListVideosQuery): Promise<Paginated<VideoView>> {
    // Admins see every library; a regular user sees only their own.
    const scopeToOwner = actor.role === Role.USER;

    const { items, total } = await this.repo.list({
      ...(scopeToOwner ? { userId: actor.id } : {}),
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return new Paginated(
      items.map((v) => this.toView(v)),
      {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    );
  }

  async getById(actor: AuthenticatedUser | undefined, id: string): Promise<VideoView> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanRead(actor, video);
    return this.toView(video);
  }

  async getStatus(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<{ videoId: string; status: VideoStatus; progress: number; errorMessage: string | null }> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanRead(actor, video);

    const job = await this.repo.latestJob(id);
    return {
      videoId: id,
      status: video.status,
      progress: job?.progress ?? 0,
      errorMessage: job?.errorMessage ?? null,
    };
  }

  async upload(
    actor: AuthenticatedUser,
    metadata: UploadMetadata,
    source: UploadSource,
  ): Promise<VideoView> {
    assertAllowedMimeType(source.mimeType);
    assertAllowedExtension(source.filename);

    // Reserve against the declared size before writing a single byte, so the
    // quota cannot be overshot by concurrent uploads. The difference between
    // the declared and actual size is released afterwards.
    const reserved = BigInt(source.declaredBytes);
    if (!(await this.repo.reserveQuota(actor.id, reserved))) {
      throw new AppError('QUOTA_EXCEEDED', 'Upload would exceed your storage quota');
    }

    let videoId: string | undefined;

    try {
      // Peek at the container signature before trusting the declared type.
      const iterator = source.stream[Symbol.asyncIterator]();
      const first = await iterator.next();
      const head = (first.value ?? Buffer.alloc(0)) as Buffer;
      assertLooksLikeVideo(head);

      const verified = Readable.from(
        (async function* () {
          yield head;
          for (;;) {
            const next = await iterator.next();
            if (next.done) return;
            yield next.value as Buffer;
          }
        })(),
      );

      const video = await this.repo.create({
        user: { connect: { id: actor.id } },
        title: metadata.title,
        description: metadata.description ?? null,
        mimeType: source.mimeType,
        // Filled in below, once the object is written and measured.
        originalUrl: '',
        fileSize: 0n,
        isPublic: metadata.isPublic ?? false,
      });
      videoId = video.id;

      const key = storageKeys.original(video.id);
      const actualBytes = await this.storage.putStream(key, verified, source.mimeType);

      await this.repo.update(video.id, { originalUrl: key, fileSize: BigInt(actualBytes) });

      // Give back whatever the upper-bound reservation over-reserved.
      const overReserved = reserved - BigInt(actualBytes);
      if (overReserved > 0n) {
        await this.repo.releaseQuota(actor.id, overReserved);
      }

      const job = await this.repo.createProcessingJob(video.id, 0);
      await this.queue.enqueueTranscode({
        videoId: video.id,
        userId: actor.id,
        originalKey: key,
        processingJobId: job.id,
      });

      const stored = await this.repo.findById(video.id);
      if (!stored) {
        throw new AppError('INTERNAL_ERROR', 'Video vanished immediately after creation');
      }
      return this.toView(stored);
    } catch (err) {
      // Never leave quota consumed by an upload that did not land.
      await this.repo.releaseQuota(actor.id, reserved);
      if (videoId) {
        await this.repo.update(videoId, { status: VideoStatus.FAILED }).catch(() => undefined);
      }
      logger.error({ err, userId: actor.id, videoId }, 'upload failed');
      throw err;
    }
  }

  /**
   * Re-runs transcoding for an existing video, reusing the stored original.
   *
   * Needed whenever the ladder or the encoder settings change: without it the
   * only way to re-derive renditions is to re-upload the source.
   */
  async reprocess(
    actor: AuthenticatedUser,
    id: string,
    options: { allowUpscale?: boolean } = {},
  ): Promise<{ videoId: string; processingJobId: string; allowUpscale: boolean }> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanWrite(actor, video);

    if (!video.originalUrl) {
      throw new AppError(
        'VALIDATION_ERROR',
        'This video has no stored original to re-process',
      );
    }

    await this.repo.update(id, { status: VideoStatus.PROCESSING });

    const job = await this.repo.createProcessingJob(id, 1);
    await this.queue.enqueueTranscode(
      {
        videoId: id,
        userId: video.userId,
        originalKey: video.originalUrl,
        processingJobId: job.id,
        allowUpscale: options.allowUpscale ?? false,
      },
      1,
    );

    logger.info(
      { videoId: id, jobId: job.id, allowUpscale: options.allowUpscale ?? false },
      'reprocess enqueued',
    );

    return {
      videoId: id,
      processingJobId: job.id,
      allowUpscale: options.allowUpscale ?? false,
    };
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateVideoInput,
  ): Promise<VideoView> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanWrite(actor, video);

    await this.repo.update(id, input);

    const updated = await this.repo.findById(id);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    return this.toView(updated);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanWrite(actor, video);

    // Soft delete the row, hard delete the bytes: storage is the expensive
    // part and the row is what audit and recovery need.
    await this.repo.softDelete(id);
    await this.repo.releaseQuota(video.userId, video.fileSize);

    const removed = await this.storage.deletePrefix(`${id}/`);
    logger.info({ videoId: id, objectsRemoved: removed }, 'video deleted');
  }

  async saveProgress(
    actor: AuthenticatedUser,
    id: string,
    position: number,
    duration: number,
  ): Promise<void> {
    const video = await this.repo.findById(id);
    if (!video) {
      throw new AppError('NOT_FOUND', 'Video not found');
    }
    this.assertCanRead(actor, video);
    await this.repo.upsertProgress(id, actor.id, position, duration);
  }

  private assertCanRead(actor: AuthenticatedUser | undefined, video: { userId: string; isPublic: boolean }): void {
    if (video.isPublic) return;
    if (!actor) {
      throw new AppError('UNAUTHORIZED', 'Authentication required for this video');
    }
    if (actor.role === Role.USER && video.userId !== actor.id) {
      throw new AppError('FORBIDDEN', 'You do not have access to this video');
    }
  }

  private assertCanWrite(actor: AuthenticatedUser, video: { userId: string }): void {
    if (actor.role === Role.USER && video.userId !== actor.id) {
      throw new AppError('FORBIDDEN', 'You do not have access to this video');
    }
  }

  /**
   * Playback URL for a video.
   *
   * Public videos are served straight from object storage so a CDN can cache
   * them. Private videos go through this API behind a short-lived token:
   * object storage grants anonymous read only to the delivered-media prefixes
   * of public content, so a direct URL for a private video would be refused.
   */
  private playbackUrlFor(video: VideoWithMedia): string {
    if (video.isPublic) {
      return this.storage.publicUrl(storageKeys.hlsMasterPlaylist(video.id));
    }

    const cfg = loadConfig();
    const token = issueStreamToken(
      { videoId: video.id, userId: video.userId },
      cfg.JWT_SECRET,
      cfg.STREAM_TOKEN_TTL_SECONDS,
    );

    return `${cfg.API_URL}/api/v1/videos/${video.id}/hls/${token}/master.m3u8`;
  }

  private toView(video: VideoWithMedia): VideoView {
    // Playability is decided by the renditions that exist, not by the job's
    // status: the master playlist is published as soon as the first rendition
    // lands, so a video is watchable while still PROCESSING.
    const playable = video.resolutions.length > 0;
    const poster = video.thumbnails[0];

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      status: video.status,
      duration: video.duration,
      fileSize: Number(video.fileSize),
      mimeType: video.mimeType,
      isPublic: video.isPublic,
      createdAt: video.createdAt.toISOString(),
      playbackUrl: playable ? this.playbackUrlFor(video) : null,
      // Only public videos can be embedded: a third-party page cannot supply
      // the bearer token a private video needs.
      embedUrl:
        playable && video.isPublic
          ? `${loadConfig().APP_URL}/embed/${video.id}`
          : null,
      posterUrl: poster ? this.storage.publicUrl(poster.url) : null,
      resolutions: video.resolutions
        .map((r) => ({
          resolution: r.resolution,
          url: this.storage.publicUrl(r.url),
          width: r.width,
          height: r.height,
          bitrate: r.bitrate,
        }))
        .sort((a, b) => a.height - b.height),
    };
  }
}
