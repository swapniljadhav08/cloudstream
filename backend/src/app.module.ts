import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig } from './config';
import { durationToSeconds } from './shared/kernel/duration';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { QueueModule } from './shared/infrastructure/queue/queue.module';
import { AuditModule } from './shared/infrastructure/audit/audit.module';
import { MetricsController } from './shared/infrastructure/metrics/metrics';
import { ResponseInterceptor } from './shared/application/response.interceptor';
import { MetricsInterceptor } from './shared/application/metrics.interceptor';
import { HttpExceptionFilter } from './shared/application/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/presentation/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { VideoModule } from './modules/video/video.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Global infrastructure.
    PrismaModule,
    StorageModule,
    QueueModule,
    AuditModule,
    // The guard is global, so it needs JwtService available at app level.
    JwtModule.register({
      secret: loadConfig().JWT_SECRET,
      signOptions: { expiresIn: durationToSeconds(loadConfig().JWT_EXPIRES_IN) },
    }),
    // Feature modules.
    AuthModule,
    VideoModule,
    UserModule,
    AdminModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    // Authenticated by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
