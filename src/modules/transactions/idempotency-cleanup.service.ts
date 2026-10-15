import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Por quanto tempo uma Idempotency-Key protege contra repetição. Um reenvio
 * legítimo (rede caiu, app tentou de novo) acontece em segundos ou minutos;
 * 24 horas é folga de sobra (mesmo prazo do Stripe). Depois disso a chave
 * pode ser apagada a qualquer momento.
 */
export const IDEMPOTENCY_KEY_TTL_HOURS = 24;

/**
 * Apaga as chaves de idempotência vencidas, para a tabela não crescer para
 * sempre. Roda todo dia às 3h (UTC) e também sempre que a API liga: no plano
 * gratuito do Render a API dorme quando fica sem acesso e pode perder o horário.
 */
@Injectable()
export class IdempotencyCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.runSafely();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    await this.runSafely();
  }

  /** Apaga as chaves mais antigas que o prazo e devolve quantas saíram. */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(
      Date.now() - IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000,
    );
    const { count } = await this.prisma.idempotency_keys.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    return count;
  }

  // Limpeza é manutenção: se falhar, registra no log e tenta na próxima vez,
  // sem derrubar a API nem a inicialização
  private async runSafely() {
    try {
      const removed = await this.purgeExpired();
      if (removed > 0) {
        this.logger.log(
          `${removed} chave(s) de idempotência vencida(s) apagada(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Falha ao limpar chaves de idempotência', error);
    }
  }
}
