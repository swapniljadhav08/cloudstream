import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { map, Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { meta, Paginated, type SuccessEnvelope } from '../kernel/envelope';

// Wraps every successful handler result in the envelope from
// docs/08_API_Design.md, so no controller builds it by hand.
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<unknown>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<unknown>> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof Paginated) {
          return {
            data: payload.items,
            pagination: payload.pagination,
            meta: meta(requestId),
          };
        }
        return { data: payload, meta: meta(requestId) };
      }),
    );
  }
}
