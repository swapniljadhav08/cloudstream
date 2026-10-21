import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { Public } from '../../../modules/auth/presentation/jwt-auth.guard';

// Prometheus metrics (docs/20_Logging_Monitoring.md).
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

@Controller()
export class MetricsController {
  // Written straight to the reply rather than returned: a returned value goes
  // through the global response interceptor, which would wrap the exposition
  // format in the JSON envelope and make it unparseable by Prometheus.
  @Public()
  @Get('metrics')
  async metrics(@Res() reply: FastifyReply): Promise<void> {
    const body = await registry.metrics();
    void reply.header('Content-Type', registry.contentType).send(body);
  }
}
