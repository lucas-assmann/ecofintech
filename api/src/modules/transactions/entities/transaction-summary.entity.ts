import { ApiProperty } from '@nestjs/swagger';
import {
  transaction_category,
  transaction_type,
} from '../../../database/generated/prisma/enums.js';

/** Total de entradas e saídas num intervalo do gráfico (um dia ou uma semana). */
export class SummaryBucket {
  /**
   * Primeiro dia do intervalo (horário de Brasília)
   * @example "2026-10-13"
   */
  date: string;

  /** @example "150.00" */
  entradas: string;

  /** @example "40.00" */
  saidas: string;
}

/** Total por categoria e tipo (ex.: transferências recebidas). */
export class SummaryCategory {
  @ApiProperty({
    enum: transaction_category,
    enumName: 'transaction_category',
  })
  category: transaction_category;

  @ApiProperty({ enum: transaction_type, enumName: 'transaction_type' })
  type: transaction_type;

  /** @example "120.00" */
  total: string;

  /** Quantidade de lançamentos */
  count: number;
}

/** Resumo de entradas e saídas da conta do usuário logado num período. */
export class TransactionSummary {
  /**
   * Primeiro dia do período (horário de Brasília)
   * @example "2026-09-14"
   */
  from: string;

  /**
   * Último dia do período (hoje, horário de Brasília)
   * @example "2026-10-13"
   */
  to: string;

  /** Tamanho de cada intervalo do gráfico: dia (7 e 30 dias) ou semana (90 dias) */
  @ApiProperty({ enum: ['day', 'week'] })
  bucket: 'day' | 'week';

  /** @example "350.00" */
  total_entradas: string;

  /** @example "120.00" */
  total_saidas: string;

  /**
   * Entradas menos saídas (pode ser negativo)
   * @example "230.00"
   */
  resultado: string;

  /** Um item por intervalo, inclusive os sem movimentação (valores zerados) */
  series: SummaryBucket[];

  /** Totais por categoria e tipo, do maior para o menor */
  by_category: SummaryCategory[];
}
