-- Migration 014: empresas (CNPJ), seus membros e convites
-- Uma pessoa entra com o próprio login e pode operar contas de empresa
-- das quais é dona ou membro. A empresa não tem login próprio.

CREATE TYPE company_status AS ENUM ('active', 'deactivated');
CREATE TYPE company_role AS ENUM ('owner', 'member');
CREATE TYPE company_invite_status AS ENUM ('pending', 'accepted', 'declined', 'canceled');

CREATE TABLE companies (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Só dígitos; UNIQUE: o mesmo CNPJ não pode ser cadastrado duas vezes
  cnpj        CHAR(14)       NOT NULL UNIQUE CHECK (cnpj ~ '^[0-9]{14}$'),
  legal_name  TEXT           NOT NULL,  -- razão social
  trade_name  TEXT           NOT NULL,  -- nome fantasia (aparece para quem recebe)
  status      company_status NOT NULL DEFAULT 'active',
  created_by  UUID           NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Quem participa de cada empresa e com qual papel
CREATE TABLE company_members (
  company_id  UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        company_role NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- A mesma pessoa não entra duas vezes na mesma empresa
  PRIMARY KEY (company_id, user_id)
);

-- Exatamente um dono por empresa: índice único só nas linhas de dono
CREATE UNIQUE INDEX company_members_one_owner
  ON company_members (company_id) WHERE role = 'owner';

-- Para listar as empresas de uma pessoa
CREATE INDEX company_members_user_id_idx ON company_members (user_id);

CREATE TABLE company_invites (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID                  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_user_id  UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by       UUID                  NOT NULL REFERENCES users(id),
  status           company_invite_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT now(),
  -- Quando foi aceito, recusado ou cancelado
  responded_at     TIMESTAMPTZ
);

-- Um único convite pendente por pessoa em cada empresa
CREATE UNIQUE INDEX company_invites_one_pending
  ON company_invites (company_id, invited_user_id) WHERE status = 'pending';
