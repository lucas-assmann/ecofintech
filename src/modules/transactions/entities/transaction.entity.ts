import { ApiProperty } from '@nestjs/swagger';
import {
  transaction_category,
  transaction_type,
} from '../../../database/generated/prisma/enums.js';

export class Counterparty {
  /** @example "Fulano de Tal" */
  name: string;

  /** @example "fulano@email.com" */
  email: string;
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

  created_at: Date;
}

/** Lançamento na listagem geral do admin: inclui o dono da conta. */
export class AdminTransaction extends Transaction {
  /** Dono da conta em que o lançamento foi feito */
  owner: Counterparty;
}
