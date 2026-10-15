import { ApiProperty } from '@nestjs/swagger';
import { deactivation_request_status } from '../../../database/generated/prisma/enums.js';

export class DeactivationRequestUser {
  /** @example "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c" */
  id: string;

  /** @example "Maria Silva" */
  name: string;

  /** @example "maria@email.com" */
  email: string;
}

/** Solicitação de desativação como devolvida pela API. */
export class DeactivationRequest {
  /** @example "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d" */
  id: string;

  @ApiProperty({
    enum: deactivation_request_status,
    enumName: 'deactivation_request_status',
    description:
      'pending (em análise pelo suporte), approved (conta desativada) ou rejected (recusada)',
  })
  status: deactivation_request_status;

  /** @example "Não vou mais usar a conta" */
  reason: string | null;

  requested_at: Date;

  /** Quando o suporte avaliou (null enquanto pendente) */
  reviewed_at: Date | null;

  /** @example "Conta encerrada a pedido do cliente" */
  review_note: string | null;

  /** Quem solicitou */
  user: DeactivationRequestUser;
}

/** Resposta ao criar uma solicitação. */
export class DeactivationRequestCreatedResponse {
  /** @example "Sua solicitação foi recebida. O suporte avaliará a solicitação." */
  message: string;

  request: DeactivationRequest;
}
