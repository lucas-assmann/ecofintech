/** Conta como devolvida pela API. */
export class Account {
  /** @example "8d2f6c1a-4b3e-4f5a-9c7d-1e2f3a4b5c6d" */
  id: string;

  /**
   * Saldo em reais, como texto com 2 casas (evita erros de arredondamento de número decimal)
   * @example "200.00"
   */
  balance: string;

  created_at: Date;

  updated_at: Date;
}
