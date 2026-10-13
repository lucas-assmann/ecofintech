-- Migration 003: perfil de acesso dos usuários
-- ENUM cria um tipo que só aceita os valores listados; o banco recusa qualquer outro.
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- DEFAULT 'user': quem já existe e quem se cadastrar começa como usuário comum.
-- Para promover alguém a admin (só pelo banco, nunca pela API):
--   UPDATE users SET role = 'admin' WHERE email = 'fulano@email.com';
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';
