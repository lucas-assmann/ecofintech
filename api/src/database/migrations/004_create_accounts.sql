-- Migration 004: contas (onde fica o saldo)

CREATE TABLE accounts (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: por enquanto, uma conta por usuário. Para permitir várias no futuro,
  -- basta uma migration removendo essa constraint.
  -- ON DELETE CASCADE: apagar o usuário apaga a conta junto. Se a conta tiver
  -- movimentações, o banco impede (ver ON DELETE RESTRICT em transactions).
  user_id    UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- NUMERIC(15,2): número exato com 2 casas decimais. Nunca use FLOAT para dinheiro.
  -- CHECK: o banco recusa qualquer operação que deixe o saldo negativo.
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Cria a conta dos usuários que já existiam antes desta migration
INSERT INTO accounts (user_id) SELECT id FROM users;
