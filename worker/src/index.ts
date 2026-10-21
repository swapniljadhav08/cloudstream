import { PrismaClient } from '@prisma/client';
import { Worker, UnrecoverableError, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { JOB_NAME, QUEUE_NAMES, transcodeJobSchema, type TranscodeJob } from '@video-streaming/shared';
import { loadConfig } from './config';
import { logger } from './logger';
import { markFailed, runTranscode } from './transcode';

const cfg = loadConfig();
const prisma = new PrismaClient();

const connection = new IORedis(cfg.REDIS_URL, {
  password: cfg.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

const worker = new Worker<TranscodeJob>(
  QUEUE_NAMES.transcode,
  async (job: Job<TranscodeJob>) => {
    if (job.name !== JOB_NAME) {
      // An unknown job name will never become valid, so retrying is pointless.
      throw new UnrecoverableError(`Unexpected job name: ${job.name}`);
    }

    const parsed = transcodeJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Malformed job payload: ${parsed.error.message}`);
    }

    const payload = parsed.data;

    return runTranscode(prisma, payload, async (percent) => {
      await job.updateProgress(percent);
      await prisma.processingJob.update({
        where: { id: payload.processingJobId },
        data: { progress: percent },
      });
    });
  },
  {
    connection,
    // Transcoding is CPU-bound: running more jobs than the box can encode
    // concurrently makes every job slower without raising throughput.
    concurrency: cfg.WORKER_CONCURRENCY,
    // A long encode must not be declared stalled while it is still working.
    lockDuration: 300_000,
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, videoId: job.data.videoId }, 'job completed');
});

worker.on('failed', async (job, err) => {
  if (!job) {
    logger.error({ err }, 'job failed before it could be loaded');
    return;
  }

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;
  const willRetry = !(err instanceof UnrecoverableError) && attemptsMade < maxAttempts;

  logger.error(
    { jobId: job.id, videoId: job.data.videoId, attemptsMade, maxAttempts, willRetry, err },
    'job failed',
  );

  const parsed = transcodeJobSchema.safeParse(job.data);
  if (parsed.success) {
    await markFailed(prisma, parsed.data, err, willRetry).catch((dbErr: unknown) => {
      logger.error({ err: dbErr }, 'could not record job failure');
    });
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});

logger.info(
  { queue: QUEUE_NAMES.transcode, concurrency: cfg.WORKER_CONCURRENCY },
  'transcode worker started',
);

// Finish the job in flight before exiting, so a deploy does not abandon a
// half-written rendition set.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    void (async () => {
      await worker.close();
      await prisma.$disconnect();
      await connection.quit();
      process.exit(0);
    })();
  });
}
