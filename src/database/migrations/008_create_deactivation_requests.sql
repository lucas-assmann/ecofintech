-- Migration 008: solicitações de desativação de conta
-- O usuário solicita; um admin aprova (a conta é desativada) ou recusa.

CREATE TYPE deactivation_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE deactivation_requests (
  id           UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID                        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       deactivation_request_status NOT NULL DEFAULT 'pending',
  reason       TEXT,                        -- motivo informado pelo usuário
  requested_at TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  -- Preenchidos quando um admin avalia (auditoria: quem decidiu e quando)
  reviewed_by  UUID                        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  review_note  TEXT,

  -- Avaliada <=> tem data de avaliação
  CONSTRAINT deactivation_requests_review_check CHECK (
    (status = 'pending') = (reviewed_at IS NULL)
  )
);

-- Índice único PARCIAL: no máximo uma solicitação pendente por usuário
-- (as já avaliadas não contam, então dá para solicitar de novo após recusa)
CREATE UNIQUE INDEX deactivation_requests_one_pending_per_user
  ON deactivation_requests (user_id) WHERE status = 'pending';
