import { z } from 'zod';

// Environment is validated once at startup (docs/27_Configuration_Guide.md).
// Variable names and defaults come from docs/26_Environment_Variables.md.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_NAME: z.string().default('video-streaming-platform'),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().optional(),

  // docs/26_Environment_Variables.md names these MINIO_*. They are S3_* here
  // because the local stand-in is LocalStack (the real S3 API) rather than
  // MinIO, whose images are no longer publicly pullable. The contract is
  // otherwise unchanged: endpoint, credentials, bucket.
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5_368_709_120),

  /**
   * Lifetime of a private-playback token. Long enough to watch a video
   * without re-authorising, short enough that a leaked URL expires.
   */
  STREAM_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(21_600),

  NEXT_PUBLIC_MEDIA_BASE_URL: z.string().url(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
