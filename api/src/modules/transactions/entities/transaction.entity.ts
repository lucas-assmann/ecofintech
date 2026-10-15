import { ApiProperty } from '@nestjs/swagger';
import {
  transaction_category,
  transaction_type,
} from '../../../database/generated/prisma/enums.js';

/** Pessoa ou empresa do outro lado da movimentação (ou dona da conta, no admin). */
export class Counterparty {
  /**
   * Nome da pessoa ou nome fantasia da empresa
   * @example "Fulano de Tal"
   */
  name: string;

  /**
   * E-mail da pessoa (null quando é uma empresa)
   * @example "fulano@email.com"
   */
  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ enum: ['person', 'company'] })
  kind: 'person' | 'company';
}

/** Quem fez a operação pela conta da empresa. */
export class Operator {
  /** @example "Maria Silva" */
  name: string;
}

/** Lançamento do extrato como devolvido pela API. */
export class Transaction {
  /** @example "5b1e7c2d-3a4f-4e6b-8c9d-0a1b2c3d4e5f" */
  id: string;

  @ApiProperty({
    enum: transaction_type,
    enumName: 'transaction_type',
    description: 'entrada (dinheiro chegou) ou saida (dinheiro saiu)',
  })
  type: transaction_type;

  @ApiProperty({
    enum: transaction_category,
    enumName: 'transaction_category',
  })
  category: transaction_category;

  /**
   * Valor em reais (texto com 2 casas)
   * @example "200.00"
   */
  amount: string;

  /**
   * Saldo da conta logo após este lançamento
   * @example "200.00"
   */
  balance_after: string;

  /** A outra pessoa da transferência (null em depósitos) */
  counterparty: Counterparty | null;

  /** @example "Aluguel" */
  description: string | null;

  /** Em estornos: id do lançamento que foi estornado (null nos demais) */
  reversal_of: string | null;

  /**
   * Quem fez a operação. Só em transferências enviadas pela conta de uma
   * empresa (para saber qual membro pagou); null nos demais.
   */
  @ApiProperty({ type: Operator, nullable: true })
  operator: Operator | null;

  created_at: Date;
}

/** Lançamento na listagem geral do admin: inclui o dono da conta. */
export class AdminTransaction extends Transaction {
  /** Dono da conta em que o lançamento foi feito (pessoa ou empresa) */
  owner: Counterparty;
}
