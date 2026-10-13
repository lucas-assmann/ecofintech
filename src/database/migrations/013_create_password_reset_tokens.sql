-- Migration 013: tokens de "esqueci minha senha"
-- O link enviado por e-mail leva um token aleatório. No banco fica só o HASH
-- (SHA-256) dele: quem conseguir ler a tabela não consegue usar os links.
-- Cada token vale por pouco tempo e só uma vez (used_at).

CREATE TABLE password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Para achar o pedido mais recente de um usuário (limite de 1 e-mail por minuto)
CREATE INDEX password_reset_tokens_user_id_created_at_idx
  ON password_reset_tokens (user_id, created_at DESC);
