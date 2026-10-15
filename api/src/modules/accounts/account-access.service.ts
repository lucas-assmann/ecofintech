import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import type { company_role } from '../../database/generated/prisma/enums.js';

/** Conta com que o usuário está operando nesta requisição. */
export interface ActiveAccountContext {
  account_id: string;
  kind: 'personal' | 'company';
  company_id: string | null;
  /** Papel na empresa; null na conta pessoal */
  role: company_role | null;
}

export const NO_ACCESS = 'Sem acesso a esta conta';

/**
 * Descobre a conta ativa a partir do cabeçalho X-Account-Id e confere se o
 * usuário pode usá-la. A checagem é feita a cada requisição (e não guardada
 * no token): quem é removido de uma empresa perde o acesso na hora.
 */
@Injectable()
export class AccountAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    user_id: string,
    header: string | undefined,
  ): Promise<ActiveAccountContext> {
    if (header !== undefined && !isUUID(header)) {
      throw new BadRequestException(
        'X-Account-Id deve ser o id (UUID) de uma conta',
      );
    }

    const account = await this.prisma.accounts.findFirst({
      // Sem cabeçalho: a conta pessoal
      where: header ? { id: header } : { user_id },
      select: {
        id: true,
        user_id: true,
        company_id: true,
        companies: {
          select: {
            status: true,
            company_members: { where: { user_id }, select: { role: true } },
          },
        },
      },
    });

    if (!account) {
      if (!header) throw new NotFoundException('Conta não encontrada');
      // Mesma resposta de "sem acesso": não revela quais contas existem
      throw new ForbiddenException(NO_ACCESS);
    }

    if (account.user_id) {
      if (account.user_id !== user_id) throw new ForbiddenException(NO_ACCESS);
      return {
        account_id: account.id,
        kind: 'personal',
        company_id: null,
        role: null,
      };
    }

    const member = account.companies?.company_members[0];
    if (account.companies?.status !== 'active' || !member) {
      throw new ForbiddenException(NO_ACCESS);
    }
    return {
      account_id: account.id,
      kind: 'company',
      company_id: account.company_id,
      role: member.role,
    };
  }
}
