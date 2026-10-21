import pino from 'pino';
import { loadConfig } from './config';

export const logger = pino({
  level: loadConfig().LOG_LEVEL,
  base: { service: 'transcode-worker' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
