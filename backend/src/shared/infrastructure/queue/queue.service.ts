import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { QUEUE_NAMES, JOB_NAME, transcodeJobSchema, type TranscodeJob } from '@video-streaming/shared';
import { loadConfig } from '../../../config';
import { logger } from '../logger/logger';

// BullMQ producer side (docs/12_Queue_System.md). The worker process consumes
// these queues; see worker/src/index.ts.
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: Redis;
  private readonly transcodeQueue: Queue<TranscodeJob>;

  constructor() {
    const cfg = loadConfig();

    this.connection = new IORedis(cfg.REDIS_URL, {
      password: cfg.REDIS_PASSWORD,
      // Required by BullMQ: it manages its own retry/backoff semantics.
      maxRetriesPerRequest: null,
    });

    this.transcodeQueue = new Queue<TranscodeJob>(QUEUE_NAMES.transcode, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    });
  }

  async enqueueTranscode(
    job: Omit<TranscodeJob, 'allowUpscale'> & { allowUpscale?: boolean },
    priority = 0,
  ): Promise<string> {
    // Validate before enqueueing: a malformed job would otherwise fail
    // repeatedly inside the worker with no useful error at the source.
    const payload = transcodeJobSchema.parse(job);

    const added = await this.transcodeQueue.add(JOB_NAME, payload, {
      // The processing job's id doubles as the queue job id, so re-running a
      // video enqueues a distinct job rather than colliding with the old one.
      jobId: payload.processingJobId,
      priority,
    });

    logger.info({ videoId: payload.videoId, jobId: added.id }, 'transcode job enqueued');
    return added.id ?? payload.processingJobId;
  }

  async counts(): Promise<Record<string, number>> {
    return this.transcodeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.transcodeQueue.close();
    await this.connection.quit();
  }
}
