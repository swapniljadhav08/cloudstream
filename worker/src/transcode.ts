import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { JobStatus, PrismaClient, VideoStatus } from '@prisma/client';
import {
  isUpscale,
  ladderForSource,
  storageKeys,
  type Rendition,
  type TranscodeJob,
} from '@video-streaming/shared';
import { loadConfig } from './config';
import { logger } from './logger';
import { buildPreviewGif, encodeRendition, extractThumbnail, probe } from './ffmpeg';
import { downloadToFile, uploadDirectory, uploadFile, uploadText } from './storage';
import { buildMasterPlaylist, type VariantInfo } from './playlist';

export type TranscodeOutcome = {
  renditions: string[];
  thumbnails: number[];
  durationSeconds: number;
};

/** Thumbnail offsets in seconds (docs/33_Bucket_Structure.md). */
const THUMBNAIL_OFFSETS = [10, 30, 60] as const;

/**
 * Reads the encoded dimensions out of a rendition's own playlist directory.
 *
 * The encoder fits the source inside the ladder box, so the real output can be
 * shorter or narrower than the box. The master playlist must advertise the
 * actual dimensions or players make poor ABR decisions.
 */
async function measureRendition(dir: string): Promise<{ width: number; height: number }> {
  const firstSegment = join(dir, 'segment_0.ts');
  const probed = await probe(firstSegment);
  return { width: probed.width, height: probed.height };
}

export async function runTranscode(
  prisma: PrismaClient,
  job: TranscodeJob,
  onProgress: (percent: number) => Promise<void>,
): Promise<TranscodeOutcome> {
  const cfg = loadConfig();
  const workDir = join(cfg.WORK_DIR, job.videoId);
  const sourcePath = join(workDir, 'source');

  await mkdir(workDir, { recursive: true });

  try {
    await prisma.$transaction([
      prisma.video.update({
        where: { id: job.videoId },
        data: { status: VideoStatus.PROCESSING },
      }),
      prisma.processingJob.update({
        where: { id: job.processingJobId },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      }),
    ]);

    // 1. Fetch the original.
    await downloadToFile(job.originalKey, sourcePath);
    await onProgress(5);

    // 2. Inspect it.
    const source = await probe(sourcePath);
    const ladder = ladderForSource(source.width, source.height, {
      allowUpscale: job.allowUpscale,
    });

    // A transcode run defines the whole rendition set. Clearing first means a
    // re-run after a ladder change cannot leave rows behind for renditions
    // this run will not produce.
    await prisma.$transaction([
      prisma.videoResolution.deleteMany({ where: { videoId: job.videoId } }),
      prisma.thumbnail.deleteMany({ where: { videoId: job.videoId } }),
    ]);
    logger.info(
      {
        videoId: job.videoId,
        source: `${source.width}x${source.height}`,
        duration: source.durationSeconds,
        renditions: ladder.map((r) => r.name),
        allowUpscale: job.allowUpscale,
      },
      'transcoding started',
    );

    // 3. Encode each rung and upload it.
    const variants: VariantInfo[] = [];
    const encodeShare = 80;

    for (const [index, rendition] of ladder.entries()) {
      const outDir = join(workDir, rendition.name);
      await mkdir(outDir, { recursive: true });

      await encodeRendition(sourcePath, outDir, rendition, source.hasAudio, source);

      const measured = await measureRendition(outDir);
      variants.push({ rendition, ...measured });

      await uploadDirectory(outDir, storageKeys.hlsPrefix(job.videoId, rendition.name));

      // Record and republish after every rung. The master playlist grows as
      // renditions land, so playback can start on the lowest one while the
      // rest are still encoding -- but the video's status stays PROCESSING
      // until the job is actually done, because COMPLETED is what the UI and
      // the API contract use to mean "finished".
      await recordRendition(prisma, job.videoId, rendition, measured);
      await publishMasterPlaylist(job.videoId, variants, source.hasAudio);

      if (index === 0) {
        // Duration is known from the probe and is useful immediately.
        await prisma.video.update({
          where: { id: job.videoId },
          data: { duration: source.durationSeconds },
        });
      }

      await onProgress(5 + Math.round(((index + 1) / ladder.length) * encodeShare));

      // Free the segments as soon as they are in storage: a 4K ladder would
      // otherwise keep every rendition on local disk at once.
      await rm(outDir, { recursive: true, force: true });
    }

    // 4. Thumbnails, skipping offsets past the end of the video.
    const offsets = THUMBNAIL_OFFSETS.filter((t) => t < source.durationSeconds);
    // Always produce at least one, from early in the video.
    const effective = offsets.length > 0 ? offsets : [Math.min(1, source.durationSeconds)];

    for (const offset of effective) {
      const file = join(workDir, `thumb_${offset}.jpg`);
      await extractThumbnail(sourcePath, file, offset, 640);
      const key = storageKeys.thumbnail(job.videoId, offset);
      await uploadFile(key, file, 'image/jpeg');

      const probed = await probe(file).catch(() => ({ width: 640, height: 360 }));
      await prisma.thumbnail.create({
        data: {
          videoId: job.videoId,
          url: key,
          timestamp: offset,
          width: probed.width,
          height: probed.height,
        },
      });
    }
    await onProgress(92);

    // 5. Preview GIF from a few seconds in, where there is usually content.
    const previewStart = Math.min(5, Math.max(0, source.durationSeconds - 3));
    const previewFile = join(workDir, 'preview.gif');
    await buildPreviewGif(sourcePath, previewFile, previewStart, 3);
    await uploadFile(storageKeys.preview(job.videoId), previewFile, 'image/gif');
    await onProgress(96);

    // 6. Sidecar metadata.
    await uploadText(
      storageKeys.metadata(job.videoId),
      JSON.stringify(
        {
          videoId: job.videoId,
          source: {
            width: source.width,
            height: source.height,
            durationSeconds: source.durationSeconds,
            hasAudio: source.hasAudio,
          },
          renditions: variants.map((v) => ({
            name: v.rendition.name,
            width: v.width,
            height: v.height,
            videoKbps: v.rendition.videoKbps,
            // Recorded so a consumer can tell a genuine rung from one that was
            // scaled up past the source's real detail.
            upscaled: isUpscale(v.rendition, source.width, source.height),
          })),
          thumbnails: effective,
          transcodedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'application/json',
    );

    await prisma.$transaction([
      prisma.video.update({
        where: { id: job.videoId },
        data: { status: VideoStatus.COMPLETED, duration: source.durationSeconds },
      }),
      prisma.processingJob.update({
        where: { id: job.processingJobId },
        data: { status: JobStatus.COMPLETED, progress: 100, completedAt: new Date() },
      }),
    ]);

    logger.info({ videoId: job.videoId, renditions: variants.length }, 'transcoding completed');

    return {
      renditions: variants.map((v) => v.rendition.name),
      thumbnails: [...effective],
      durationSeconds: source.durationSeconds,
    };
  } finally {
    // Always clear the scratch directory, including on failure: a retried job
    // starts clean and the disk does not fill with abandoned sources.
    await rm(workDir, { recursive: true, force: true });
  }
}

async function publishMasterPlaylist(
  videoId: string,
  variants: VariantInfo[],
  hasAudio: boolean,
): Promise<void> {
  await uploadText(
    storageKeys.hlsMasterPlaylist(videoId),
    buildMasterPlaylist(variants, hasAudio),
    'application/vnd.apple.mpegurl',
    // Short TTL: this file is rewritten as each rendition lands.
    'public, max-age=30',
  );
}

async function recordRendition(
  prisma: PrismaClient,
  videoId: string,
  rendition: Rendition,
  measured: { width: number; height: number },
): Promise<void> {
  const url = storageKeys.hlsVariantPlaylist(videoId, rendition.name);

  // Upsert so a retried job does not collide on (videoId, resolution).
  await prisma.videoResolution.upsert({
    where: { videoId_resolution: { videoId, resolution: rendition.name } },
    create: {
      videoId,
      resolution: rendition.name,
      url,
      bitrate: rendition.videoKbps * 1000,
      width: measured.width,
      height: measured.height,
    },
    update: {
      url,
      bitrate: rendition.videoKbps * 1000,
      width: measured.width,
      height: measured.height,
    },
  });
}

export async function markFailed(
  prisma: PrismaClient,
  job: TranscodeJob,
  error: Error,
  willRetry: boolean,
): Promise<void> {
  await prisma.processingJob.update({
    where: { id: job.processingJobId },
    data: {
      status: willRetry ? JobStatus.PENDING : JobStatus.FAILED,
      errorMessage: error.message.slice(0, 1_000),
      ...(willRetry ? {} : { completedAt: new Date() }),
    },
  });

  // The video only becomes FAILED once no attempts remain; a transient
  // failure mid-retry should not show the user a dead video.
  if (!willRetry) {
    await prisma.video.update({
      where: { id: job.videoId },
      data: { status: VideoStatus.FAILED },
    });
  }
}
