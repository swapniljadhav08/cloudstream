import { Controller, Get } from '@nestjs/common';
import { Role, VideoStatus, JobStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { QueueService } from '../../../shared/infrastructure/queue/queue.service';
import { Roles } from '../../auth/presentation/jwt-auth.guard';

export type SystemStats = {
  users: { total: number; active: number };
  videos: Record<VideoStatus, number>;
  jobs: Record<string, number>;
  storage: { totalBytesUsed: number };
};

// Admin surface from docs/10_User_Roles.md. The global guard enforces the role.
@Controller('admin')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Get('stats')
  async stats(): Promise<SystemStats> {
    const [users, activeUsers, videoGroups, storage, queueCounts] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.video.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.aggregate({ _sum: { storageUsed: true } }),
      this.queue.counts(),
    ]);

    const videos = Object.fromEntries(
      Object.values(VideoStatus).map((s) => [s, 0]),
    ) as Record<VideoStatus, number>;
    for (const group of videoGroups) {
      videos[group.status] = group._count._all;
    }

    return {
      users: { total: users, active: activeUsers },
      videos,
      jobs: queueCounts,
      storage: { totalBytesUsed: Number(storage._sum.storageUsed ?? 0n) },
    };
  }

  @Get('jobs')
  async jobs() {
    const jobs = await this.prisma.processingJob.findMany({
      where: { status: { in: [JobStatus.PENDING, JobStatus.PROCESSING, JobStatus.FAILED] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { video: { select: { id: true, title: true } } },
    });

    return jobs.map((j) => ({
      id: j.id,
      videoId: j.videoId,
      videoTitle: j.video.title,
      status: j.status,
      progress: j.progress,
      attempts: j.attempts,
      errorMessage: j.errorMessage,
      createdAt: j.createdAt.toISOString(),
    }));
  }

  @Get('audit')
  async audit() {
    const entries = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      action: e.action,
      resource: e.resource,
      resourceId: e.resourceId,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
