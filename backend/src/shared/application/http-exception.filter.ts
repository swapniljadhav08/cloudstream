import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { meta, type ErrorEnvelope } from '../kernel/envelope';
import { AppError, type ErrorCode } from '../kernel/errors';
import { logger } from '../infrastructure/logger/logger';

// Single place where a thrown error becomes an HTTP response
// (docs/19_Error_Handling.md, docs/30_API_Status_Codes.md).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const { status, code, message, details } = this.normalise(exception);

    // 5xx means we broke something: log the stack. 4xx is the caller's
    // problem and would only add noise at error level.
    if (status >= 500) {
      logger.error({ err: exception, requestId, path: req.url }, 'unhandled request failure');
    } else {
      logger.debug({ requestId, path: req.url, code, message }, 'request rejected');
    }

    const body: ErrorEnvelope = {
      error: { code, message, ...(details === undefined ? {} : { details }) },
      meta: meta(requestId),
    };

    void reply.status(status).send(body);
  }

  private normalise(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: exception.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: status === 404 ? 'NOT_FOUND' : status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
        message: exception.message,
      };
    }

    // Anything else is a bug. Do not leak the internal message to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}
