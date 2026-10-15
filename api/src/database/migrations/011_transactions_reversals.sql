-- Migration 011: estornos
-- Um estorno é um lançamento inverso que aponta para o original (reversal_of).

ALTER TABLE transactions
  ADD COLUMN reversal_of UUID REFERENCES transactions(id) ON DELETE RESTRICT;

-- Índice único parcial: cada lançamento só pode ser estornado uma vez
CREATE UNIQUE INDEX transactions_reversal_of_unique
  ON transactions (reversal_of) WHERE reversal_of IS NOT NULL;

-- Regras de consistência, agora incluindo estorno:
-- depósito: entrada, sem contraparte;
-- transferência: com contraparte diferente da própria conta;
-- estorno: sempre aponta para o original (contraparte só se for de transferência);
-- só estornos têm reversal_of.
ALTER TABLE transactions DROP CONSTRAINT transactions_category_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_check CHECK (
  (category = 'deposito' AND type = 'entrada' AND counterparty_account_id IS NULL
    AND reversal_of IS NULL)
  OR
  (category = 'transferencia' AND counterparty_account_id IS NOT NULL
    AND counterparty_account_id <> account_id AND reversal_of IS NULL)
  OR
  (category = 'estorno' AND reversal_of IS NOT NULL
    AND (counterparty_account_id IS NULL OR counterparty_account_id <> account_id))
);
