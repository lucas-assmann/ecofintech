-- Migration 017: índice para a limpeza das chaves de idempotência
-- A limpeza diária apaga as chaves com created_at mais antigo que 24h
-- (IdempotencyCleanupService). Sem índice, o banco leria a tabela inteira
-- para achá-las; com ele, vai direto nas vencidas.
CREATE INDEX idempotency_keys_created_at_idx ON idempotency_keys (created_at);
