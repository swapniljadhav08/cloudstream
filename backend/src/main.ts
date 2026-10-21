import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { logger } from './shared/infrastructure/logger/logger';
import { MAX_FILE_SIZE_BYTES } from './modules/video/domain/upload-policy';

async function bootstrap(): Promise<void> {
  // Fail before the server binds if configuration is wrong.
  const cfg = loadConfig();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1024 * 1024,
      trustProxy: true,
      // Private playback tokens travel as a path segment and are longer than
      // Fastify's 100-character default param limit, which would reject them
      // with a 414 before the route ran.
      maxParamLength: 512,
    }),
    { logger: ['error', 'warn'] },
  );

  // Streamed multipart uploads (docs/31_File_Upload_Policy.md).
  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: 1,
      fields: 10,
    },
  });

  app.setGlobalPrefix('api/v1', {
    // Probes and metrics sit outside the versioned API so monitoring does not
    // break when the API version changes.
    exclude: ['health', 'metrics'],
  });

  app.enableCors({
    origin: [cfg.APP_URL],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  app.enableShutdownHooks();

  await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
  logger.info({ port: cfg.PORT, env: cfg.NODE_ENV }, 'api listening');
}

void bootstrap().catch((err: unknown) => {
  // Configuration and connection failures land here; print plainly because
  // the structured logger may itself depend on the config that just failed.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
