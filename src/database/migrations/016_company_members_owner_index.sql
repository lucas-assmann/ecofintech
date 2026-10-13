-- Migration 016: refaz o índice de "um dono por empresa"
-- O índice da 014 era único só em company_id (filtrado por role = 'owner').
-- O Prisma (db pull) entende isso como company_id único na tabela inteira e
-- passa a achar que cada empresa tem um membro só. Com (company_id, role) a
-- regra é a mesma — nas linhas filtradas role é sempre 'owner' — e o Prisma
-- entende corretamente que uma empresa tem vários membros.

DROP INDEX company_members_one_owner;

CREATE UNIQUE INDEX company_members_one_owner
  ON company_members (company_id, role) WHERE role = 'owner';
