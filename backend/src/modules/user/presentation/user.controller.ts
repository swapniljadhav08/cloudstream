import { Controller, Get, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/kernel/errors';

export type MeView = {
  id: string;
  email: string;
  name: string;
  role: string;
  storageUsed: number;
  storageQuota: number;
  videoCount: number;
};

@Controller('users')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req: FastifyRequest): Promise<MeView> {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: req.user.id, deletedAt: null },
      include: { _count: { select: { videos: true } } },
    });

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storageUsed: Number(user.storageUsed),
      storageQuota: Number(user.storageQuota),
      videoCount: user._count.videos,
    };
  }
}
