-- Migration 002: ajusta users aos campos definidos (id, name, email, date_of_birth, password)
-- A 001 já rodou, então a mudança vem numa migration nova em vez de editar a antiga.

-- DATE guarda só a data (sem hora/fuso), ideal para data de nascimento.
-- NOT NULL direto só funciona porque a tabela está vazia; com dados, seria preciso
-- adicionar como nula, preencher e depois aplicar o NOT NULL.
ALTER TABLE users ADD COLUMN date_of_birth DATE NOT NULL;

ALTER TABLE users DROP COLUMN cpf;
