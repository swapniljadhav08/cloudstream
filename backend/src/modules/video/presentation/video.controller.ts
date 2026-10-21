import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyReply } from 'fastify';
import { AppError } from '../../../shared/kernel/errors';
import { mediaContentType, verifyStreamToken } from '../../../shared/kernel/stream-token';
import { StorageService } from '../../../shared/infrastructure/storage/storage.service';
import { loadConfig } from '../../../config';
import { hlsSubPath } from '@video-streaming/shared';
import { Paginated } from '../../../shared/kernel/envelope';
import { AuditService } from '../../../shared/infrastructure/audit/audit.service';
import { Public } from '../../auth/presentation/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/application/auth.service';
import { VideoService, type VideoView } from '../application/video.service';
import { MAX_FILE_SIZE_BYTES } from '../domain/upload-policy';
import {
  listVideosSchema,
  progressSchema,
  reprocessSchema,
  updateVideoSchema,
  uploadMetadataSchema,
} from './dtos';

function actorOf(req: FastifyRequest): AuthenticatedUser {
  if (!req.user) {
    // The global guard populates this; reaching here means a route was
    // mistakenly marked @Public() while still calling actorOf.
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }
  return req.user;
}

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videos: VideoService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Serves private HLS media behind a path-embedded capability token.
   *
   * Declared before the other `:id/...` routes so the wildcard is matched for
   * playback paths rather than being shadowed. @Public() because the token is
   * the credential: a media player cannot attach an Authorization header to
   * the segment requests it derives from a playlist.
   */
  @Public()
  // Fastify requires the wildcard to be a bare trailing `*`; the matched
  // remainder is read from params below rather than via @Param.
  @Get(':id/hls/:token/*')
  async streamPrivate(
    @Param('id') id: string,
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const path = (req.params as Record<string, string>)['*'] ?? '';
    const claims = verifyStreamToken(token, id, loadConfig().JWT_SECRET);
    if (!claims) {
      throw new AppError('FORBIDDEN', 'Playback token is invalid or expired');
    }

    // Reject traversal before the key is built: without this, a crafted path
    // could read objects outside the video's own prefix.
    if (path.includes('..')) {
      throw new AppError('VALIDATION_ERROR', 'Invalid media path');
    }

    const stream = await this.storage.getObjectStream(`${id}/${hlsSubPath(path)}`);

    void reply
      .header('Content-Type', mediaContentType(path))
      .header('Cache-Control', 'private, max-age=60')
      .send(stream);
  }

  @Get()
  async list(@Query() query: unknown, @Req() req: FastifyRequest): Promise<Paginated<VideoView>> {
    return this.videos.list(actorOf(req), listVideosSchema.parse(query));
  }

  // Public videos are playable without a token; the service still enforces
  // ownership for private ones.
  @Public()
  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: FastifyRequest): Promise<VideoView> {
    return this.videos.getById(req.user, id);
  }

  @Get(':id/status')
  async status(@Param('id') id: string, @Req() req: FastifyRequest) {
    return this.videos.getStatus(actorOf(req), id);
  }

  @Post()
  @HttpCode(201)
  async upload(@Req() req: FastifyRequest): Promise<VideoView> {
    if (!req.isMultipart()) {
      throw new AppError('VALIDATION_ERROR', 'Expected a multipart/form-data upload');
    }

    const actor = actorOf(req);

    // Walk the parts in order. Text fields are collected until the file part
    // appears; the file is then streamed straight to storage rather than
    // buffered, so a 5 GB upload does not need 5 GB of memory.
    const fields: Record<string, string> = {};

    for await (const part of req.parts()) {
      if (part.type === 'field') {
        fields[part.fieldname] = String(part.value);
        continue;
      }

      if (part.fieldname !== 'file') {
        // Drain unexpected file parts; leaving them unread stalls the request.
        part.file.resume();
        continue;
      }

      const metadata = uploadMetadataSchema.parse(fields);
      const declared = Number(req.headers['content-length'] ?? 0);

      if (declared > MAX_FILE_SIZE_BYTES) {
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          `Upload exceeds the ${MAX_FILE_SIZE_BYTES} byte limit`,
        );
      }

      const video = await this.videos.upload(actor, metadata, {
        filename: part.filename,
        mimeType: part.mimetype,
        declaredBytes: declared,
        stream: part.file,
      });

      await this.audit.record(req, {
        action: 'video.upload',
        resource: 'video',
        resourceId: video.id,
        metadata: { title: video.title, fileSize: video.fileSize },
      });

      return video;
    }

    throw new AppError('VALIDATION_ERROR', 'No file part named "file" was provided');
  }

  @Post(':id/reprocess')
  @HttpCode(202)
  async reprocess(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<{ videoId: string; processingJobId: string; allowUpscale: boolean }> {
    const input = reprocessSchema.parse(body ?? {});
    const result = await this.videos.reprocess(actorOf(req), id, input);

    await this.audit.record(req, {
      action: 'video.reprocess',
      resource: 'video',
      resourceId: id,
      metadata: { allowUpscale: result.allowUpscale },
    });

    return result;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<VideoView> {
    const video = await this.videos.update(actorOf(req), id, updateVideoSchema.parse(body));
    await this.audit.record(req, { action: 'video.update', resource: 'video', resourceId: id });
    return video;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: FastifyRequest): Promise<void> {
    await this.videos.remove(actorOf(req), id);
    await this.audit.record(req, { action: 'video.delete', resource: 'video', resourceId: id });
  }

  @Put(':id/progress')
  @HttpCode(204)
  async saveProgress(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const input = progressSchema.parse(body);
    await this.videos.saveProgress(actorOf(req), id, input.position, input.duration);
  }
}
