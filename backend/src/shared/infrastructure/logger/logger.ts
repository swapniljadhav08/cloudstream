import pino from 'pino';
import { loadConfig } from '../../../config';

// Structured JSON logs (docs/20_Logging_Monitoring.md). Secrets are redacted
// here rather than at call sites so a new log line cannot leak one by default.
export const logger = pino({
  level: loadConfig().LOG_LEVEL,
  base: { service: loadConfig().APP_NAME },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
