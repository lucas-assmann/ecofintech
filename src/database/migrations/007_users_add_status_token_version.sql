-- Migration 007: situação da conta e controle de sessão

-- Conta desativada não faz login nem movimenta, mas o histórico é mantido
CREATE TYPE user_status AS ENUM ('active', 'deactivated');

ALTER TABLE users
  ADD COLUMN status         user_status NOT NULL DEFAULT 'active',
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  -- Versão dos tokens: vai dentro de cada token emitido. Incrementar este número
  -- invalida todos os tokens anteriores do usuário (troca de senha, logout,
  -- desativação), obrigando a fazer login de novo.
  ADD COLUMN token_version  INTEGER     NOT NULL DEFAULT 0;
