import { Injectable } from '@nestjs/common';
import type { Prisma, ProcessingJob, Video, VideoStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

export type VideoListFilter = {
  userId?: string;
  status?: VideoStatus;
  search?: string;
  page: number;
  limit: number;
};

export type VideoWithMedia = Prisma.VideoGetPayload<{
  include: { resolutions: true; thumbnails: true };
}>;

@Injectable()
export class VideoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: VideoListFilter): Promise<{ items: VideoWithMedia[]; total: number }> {
    // Soft-deleted rows are never returned (docs/07_Database_Schema.md
    // "Decision: Soft Delete").
    const where: Prisma.VideoWhereInput = {
      deletedAt: null,
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        include: { resolutions: true, thumbnails: true },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.video.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<VideoWithMedia | null> {
    return this.prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: { resolutions: true, thumbnails: true },
    });
  }

  async create(data: Prisma.VideoCreateInput): Promise<Video> {
    return this.prisma.video.create({ data });
  }

  async update(id: string, data: Prisma.VideoUpdateInput): Promise<Video> {
    return this.prisma.video.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async createProcessingJob(videoId: string, priority: number): Promise<{ id: string }> {
    return this.prisma.processingJob.create({
      data: { videoId, priority },
      select: { id: true },
    });
  }

  async latestJob(videoId: string): Promise<ProcessingJob | null> {
    return this.prisma.processingJob.findFirst({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertProgress(
    videoId: string,
    userId: string,
    position: number,
    duration: number,
  ): Promise<void> {
    const completed = duration > 0 && position / duration >= 0.95;
    await this.prisma.videoProgress.upsert({
      where: { videoId },
      create: { videoId, userId, position, duration, completed },
      update: { position, duration, completed },
    });
  }

  /**
   * Reserves storage quota and records the usage atomically.
   *
   * The limit check and the increment are a single conditional UPDATE, so two
   * concurrent uploads cannot both pass the check and together exceed the
   * quota. Returns false when the upload would not fit.
   */
  async reserveQuota(userId: string, bytes: bigint): Promise<boolean> {
    const affected = await this.prisma.$executeRaw`
      UPDATE users
      SET "storageUsed" = "storageUsed" + ${bytes}
      WHERE id = ${userId}
        AND "deletedAt" IS NULL
        AND "storageUsed" + ${bytes} <= "storageQuota"
    `;
    return affected === 1;
  }

  async releaseQuota(userId: string, bytes: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE users
      SET "storageUsed" = GREATEST(0, "storageUsed" - ${bytes})
      WHERE id = ${userId}
    `;
  }
}
