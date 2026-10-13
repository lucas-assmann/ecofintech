-- Migration 012: índice para a listagem geral de lançamentos (admin)
-- O índice da 005 começa por account_id e só ajuda no extrato de UMA conta.
-- A listagem do admin percorre todas as contas por data, do mais recente
-- para o mais antigo, então precisa de um índice só por created_at.
CREATE INDEX transactions_created_at_idx ON transactions (created_at DESC, id DESC);
