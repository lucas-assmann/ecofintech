-- Migration 006: CPF e telefone no cadastro
-- Os dois guardam só dígitos; a API remove pontuação antes de salvar.
-- NOT NULL direto funciona porque a tabela estava vazia ao aplicar.

-- CPF: único (identifica a pessoa e serve como chave de transferência)
ALTER TABLE users
  ADD COLUMN cpf CHAR(11) NOT NULL UNIQUE
  CONSTRAINT users_cpf_format CHECK (cpf ~ '^[0-9]{11}$');

-- Telefone: DDD + número (10 dígitos fixo, 11 celular)
ALTER TABLE users
  ADD COLUMN phone VARCHAR(11) NOT NULL
  CONSTRAINT users_phone_format CHECK (phone ~ '^[0-9]{10,11}$');
