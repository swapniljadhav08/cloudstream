import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../../../config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const cfg = loadConfig();
    // connection_limit is appended rather than set in the generated .env so
    // DATABASE_POOL_SIZE stays the single knob (docs/26_Environment_Variables.md).
    const url = new URL(cfg.DATABASE_URL);
    url.searchParams.set('connection_limit', String(cfg.DATABASE_POOL_SIZE));

    super({ datasources: { db: { url: url.toString() } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
