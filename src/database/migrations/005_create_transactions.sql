-- Migration 005: movimentações (extrato)
-- Cada linha é um lançamento em UMA conta. Uma transferência gera duas linhas:
-- uma 'saida' na conta de origem e uma 'entrada' na conta de destino.
-- Lançamentos nunca são editados nem apagados (como num extrato bancário).

CREATE TYPE transaction_type AS ENUM ('entrada', 'saida');
CREATE TYPE transaction_category AS ENUM ('deposito', 'transferencia');

CREATE TABLE transactions (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: uma conta com movimentações não pode ser apagada
  account_id              UUID                 NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  type                    transaction_type     NOT NULL,
  category                transaction_category NOT NULL,
  amount                  NUMERIC(15,2)        NOT NULL CHECK (amount > 0),
  -- Saldo da conta logo após este lançamento (facilita montar o extrato)
  balance_after           NUMERIC(15,2)        NOT NULL CHECK (balance_after >= 0),
  -- A outra conta envolvida (em transferências). NULL em depósitos.
  counterparty_account_id UUID                 REFERENCES accounts(id) ON DELETE RESTRICT,
  description             TEXT,
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT now(),

  -- Regras de consistência garantidas pelo próprio banco:
  -- depósito é sempre entrada e não tem contraparte;
  -- transferência sempre tem contraparte, e ela não pode ser a própria conta.
  CONSTRAINT transactions_category_check CHECK (
    (category = 'deposito' AND type = 'entrada' AND counterparty_account_id IS NULL)
    OR
    (category = 'transferencia' AND counterparty_account_id IS NOT NULL
      AND counterparty_account_id <> account_id)
  )
);

-- Índice para o extrato: busca por conta, do mais recente para o mais antigo
CREATE INDEX transactions_account_id_created_at_idx
  ON transactions (account_id, created_at DESC);
