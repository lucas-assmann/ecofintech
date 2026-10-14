-- Migration 015: contas de empresa
-- Uma conta pertence a uma pessoa (user_id) OU a uma empresa (company_id).
-- As contas que já existem são todas pessoais e continuam válidas.

ALTER TABLE accounts ALTER COLUMN user_id DROP NOT NULL;

-- UNIQUE: cada empresa tem uma única conta. RESTRICT: empresa com conta não é apagada.
ALTER TABLE accounts
  ADD COLUMN company_id UUID UNIQUE REFERENCES companies(id) ON DELETE RESTRICT;

-- num_nonnulls conta quantos dos valores não são nulos: tem que ser exatamente 1
ALTER TABLE accounts ADD CONSTRAINT accounts_owner_check
  CHECK (num_nonnulls(user_id, company_id) = 1);
