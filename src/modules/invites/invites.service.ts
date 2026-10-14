import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PendingInvite } from './entities/pending-invite.entity.js';

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Convites que o usuário ainda não respondeu. */
  async listPending(user_id: string): Promise<PendingInvite[]> {
    const invites = await this.prisma.company_invites.findMany({
      where: { invited_user_id: user_id, status: 'pending' },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        created_at: true,
        companies: { select: { id: true, trade_name: true, cnpj: true } },
        users_company_invites_invited_byTousers: { select: { name: true } },
      },
    });
    return invites.map(
      ({
        companies,
        users_company_invites_invited_byTousers: sender,
        ...invite
      }) => ({ ...invite, company: companies, invited_by: sender }),
    );
  }

  /** Aceita: a pessoa vira membro da empresa. */
  async accept(user_id: string, invite_id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Muda o status só se o convite é desta pessoa e ainda está pendente:
      // aceitar duas vezes ao mesmo tempo não cria dois membros
      const { count } = await tx.company_invites.updateMany({
        where: { id: invite_id, invited_user_id: user_id, status: 'pending' },
        data: { status: 'accepted', responded_at: new Date() },
      });
      if (count === 0) throw new NotFoundException('Convite não encontrado');

      const { company_id } = await tx.company_invites.findUniqueOrThrow({
        where: { id: invite_id },
        select: { company_id: true },
      });
      await tx.company_members.create({
        data: { company_id, user_id, role: 'member' },
      });
      await tx.audit_logs.create({
        data: {
          actor_id: user_id,
          action: 'company.member_join',
          target_type: 'company',
          target_id: company_id,
          details: { invite_id },
        },
      });
    });
  }

  /** Recusa o convite. */
  async decline(user_id: string, invite_id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.company_invites.updateMany({
        where: { id: invite_id, invited_user_id: user_id, status: 'pending' },
        data: { status: 'declined', responded_at: new Date() },
      });
      if (count === 0) throw new NotFoundException('Convite não encontrado');
    });
  }
}
