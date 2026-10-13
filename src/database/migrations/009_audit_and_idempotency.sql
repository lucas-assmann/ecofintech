-- Migration 009: auditoria e idempotência

-- Quem executou cada lançamento: o admin (depósito/estorno) ou o remetente (transferência).
-- ON DELETE RESTRICT: quem tem operações registradas não pode ser apagado (use a desativação).
-- NOT NULL direto funciona porque a tabela estava vazia ao aplicar.
ALTER TABLE transactions
  ADD COLUMN created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT;

-- Agrupa os lançamentos de uma mesma operação: as duas pontas de uma
-- transferência (ou de um estorno de transferência) têm o mesmo operation_id.
ALTER TABLE transactions
  ADD COLUMN operation_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX transactions_operation_id_idx ON transactions (operation_id);

-- Chaves de idempotência: o front manda um UUID por operação (header Idempotency-Key).
-- Se a mesma chave chegar de novo (ex.: o app reenviou), a API devolve o resultado
-- original em vez de mover o dinheiro outra vez.
CREATE TABLE idempotency_keys (
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key            UUID        NOT NULL,
  endpoint       TEXT        NOT NULL,
  -- Hash do corpo da requisição: a mesma chave com dados diferentes é recusada
  request_hash   TEXT        NOT NULL,
  -- Lançamento gerado (preenchido ao concluir a operação, na mesma transação)
  transaction_id UUID        REFERENCES transactions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A chave é única por usuário
  PRIMARY KEY (user_id, key)
);

-- Registro de ações administrativas que não ficam em outras tabelas
-- (ex.: remoção de usuário, quando a linha do usuário deixa de existir).
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem fez. SET NULL: o registro continua mesmo se o autor for removido depois.
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,   -- ex.: 'user.delete'
  target_type TEXT        NOT NULL,   -- ex.: 'user'
  target_id   UUID        NOT NULL,   -- sem FK: o alvo pode não existir mais
  details     JSONB,                  -- dados do alvo no momento da ação
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
