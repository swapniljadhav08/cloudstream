import { Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { logger } from '../logger/logger';

export type AuditEntry = {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
};

// Audit trail (docs/17_Security.md, audit_logs in docs/07_Database_Schema.md).
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(req: FastifyRequest, entry: AuditEntry): Promise<void> {
    // An audit write must never fail the operation it describes. It is logged
    // loudly instead, so a broken trail is visible without causing 500s.
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? req.user?.id ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          ipAddress: req.ip ?? null,
          userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
          metadata: entry.metadata,
        },
      });
    } catch (err) {
      logger.error({ err, action: entry.action }, 'failed to write audit log');
    }
  }
}
