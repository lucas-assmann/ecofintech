import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { assertUtcSession } from './assert-utc-session.js';

/**
 * Cliente do Prisma disponível para injeção em qualquer service.
 * O client é gerado a partir do banco (`npm run db:pull`), então os tipos
 * sempre refletem as tabelas criadas pelas migrations SQL.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  // Confere o fuso do banco ao ligar, antes de qualquer requisição
  async onModuleInit() {
    await assertUtcSession(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
