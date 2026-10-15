-- Migration 010: nova categoria de lançamento 'estorno'
-- Fica sozinha porque o PostgreSQL não permite usar um valor novo de ENUM
-- na mesma transação em que ele foi criado (a 011 usa este valor).
ALTER TYPE transaction_category ADD VALUE 'estorno';
