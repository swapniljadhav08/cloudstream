import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import { Public } from './modules/auth/presentation/jwt-auth.guard';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health(): Promise<{ status: string; database: string }> {
    // A liveness probe that does not touch the database would stay green
    // while every request fails, so it issues the cheapest real query.
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok' };
  }
}
