import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { httpDuration, httpRequests } from '../infrastructure/metrics/metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    // routerPath is the template (/videos/:id), not the concrete URL, so the
    // label set stays bounded instead of growing with every video id.
    const route = req.routeOptions?.url ?? req.url;
    const stop = httpDuration.startTimer();

    const record = (): void => {
      const labels = {
        method: req.method,
        route,
        status: String(reply.statusCode),
      };
      stop(labels);
      httpRequests.inc(labels);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
