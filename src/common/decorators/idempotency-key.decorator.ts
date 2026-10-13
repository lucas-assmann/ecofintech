import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Lê o header Idempotency-Key (obrigatório, UUID).
 * O front gera um UUID novo para cada operação e o reenvia igual em caso de
 * nova tentativa (ex.: a internet caiu antes da resposta chegar).
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.header(IDEMPOTENCY_HEADER);
    if (!key || !isUUID(key)) {
      throw new BadRequestException(
        `Header ${IDEMPOTENCY_HEADER} obrigatório (um UUID novo por operação)`,
      );
    }
    return key.toLowerCase();
  },
);

/** Documenta o header no Swagger. */
export const ApiIdempotencyKey = () =>
  applyDecorators(
    ApiHeader({
      name: IDEMPOTENCY_HEADER,
      required: true,
      description:
        'UUID único por operação. Reenviar a mesma chave devolve o resultado original sem repetir a operação.',
      schema: { type: 'string', format: 'uuid' },
    }),
  );
