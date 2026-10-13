-- Migration 001: tabela de usuários
-- Regra: nunca edite uma migration que já rodou. Para mudar algo, crie uma nova
-- (ex.: 002_add_phone_to_users.sql com ALTER TABLE users ADD COLUMN ...).

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  cpf           CHAR(11)    NOT NULL UNIQUE,  -- só os 11 dígitos, sem pontuação
  password_hash TEXT        NOT NULL,         -- nunca a senha em texto puro
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
