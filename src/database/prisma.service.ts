import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * Cliente do Prisma disponível para injeção em qualquer service.
 * O client é gerado a partir do banco (`npm run db:pull`), então os tipos
 * sempre refletem as tabelas criadas pelas migrations SQL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
