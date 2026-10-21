import { z } from 'zod';

// Queue and job contract from docs/12_Queue_System.md and
// docs/21_Background_Jobs.md. Separate queues per concern.

export const QUEUE_NAMES = {
  transcode: 'transcode',
  thumbnail: 'thumbnail',
  metadata: 'metadata',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Validated on both sides of the queue: the producer cannot enqueue a job
// shape the consumer will not understand.
export const transcodeJobSchema = z.object({
  videoId: z.string().min(1),
  userId: z.string().min(1),
  originalKey: z.string().min(1),
  processingJobId: z.string().min(1),
  /**
   * Produce the full ladder even where that means scaling the source up.
   * Off by default; see ladderForSource.
   */
  allowUpscale: z.boolean().default(false),
});

export type TranscodeJob = z.infer<typeof transcodeJobSchema>;

export const JOB_NAME = 'transcode-video' as const;
