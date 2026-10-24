import { z } from 'zod';

// The worker shares the application's environment contract but needs only the
// database, queue, storage and ffmpeg settings.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().optional(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  /** See the backend's config: defaults to S3_BUCKET unless storage needs a split. */
  S3_BUCKET_MEDIA: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  FFMPEG_PATH: z.string().default('/usr/bin/ffmpeg'),
  FFPROBE_PATH: z.string().default('/usr/bin/ffprobe'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Concurrent transcode jobs per worker process. */
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  /** Scratch directory for downloads and encoder output. */
  WORK_DIR: z.string().default('/tmp/transcode'),
});

export type WorkerConfig = z.infer<typeof envSchema>;

let cached: WorkerConfig | undefined;

export function loadConfig(): WorkerConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid worker environment:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
