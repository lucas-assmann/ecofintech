import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import type { company_role } from '../../database/generated/prisma/enums.js';
import { OperableAccount } from '../accounts/entities/operable-account.entity.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { CompanyMembers } from './entities/company-members.entity.js';

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Abre uma empresa: quem abre vira o dono e a conta da empresa é criada junto. */
  async create(
    user_id: string,
    dto: CreateCompanyDto,
  ): Promise<OperableAccount> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await tx.companies.create({
          data: {
            cnpj: dto.cnpj,
            legal_name: dto.legal_name,
            trade_name: dto.trade_name,
            created_by: user_id,
            company_members: { create: { user_id, role: 'owner' } },
            accounts: { create: {} },
          },
          select: {
            id: true,
            cnpj: true,
            trade_name: true,
            accounts: { select: { id: true, balance: true } },
          },
        });
        await tx.audit_logs.create({
          data: {
            actor_id: user_id,
            action: 'company.create',
            target_type: 'company',
            target_id: company.id,
            details: { cnpj: company.cnpj, trade_name: company.trade_name },
          },
        });
        return {
          id: company.accounts!.id,
          kind: 'company',
          name: company.trade_name,
          document: company.cnpj,
          balance: company.accounts!.balance.toFixed(2),
          role: 'owner',
          company_id: company.id,
        };
      });
    } catch (error) {
      // cnpj é UNIQUE no banco
      if (isUniqueViolation(error)) {
        throw new ConflictException('Este CNPJ já está cadastrado');
      }
      throw error;
    }
  }

  /** Membros da empresa (qualquer membro vê); convites pendentes só para o dono. */
  async listMembers(
    user_id: string,
    company_id: string,
  ): Promise<CompanyMembers> {
    const role = await this.assertMember(user_id, company_id);

    const members = await this.prisma.company_members.findMany({
      where: { company_id },
      // 'owner' vem antes de 'member' na ordem do enum
      orderBy: [{ role: 'asc' }, { created_at: 'asc' }],
      select: {
        user_id: true,
        role: true,
        created_at: true,
        users: { select: { name: true, email: true } },
      },
    });

    const invites =
      role === 'owner'
        ? await this.prisma.company_invites.findMany({
            where: { company_id, status: 'pending' },
            orderBy: { created_at: 'asc' },
            select: {
              id: true,
              created_at: true,
              users_company_invites_invited_user_idTousers: {
                select: { name: true, email: true },
              },
            },
          })
        : [];

    return {
      members: members.map(({ users, ...member }) => ({
        ...member,
        name: users.name,
        email: users.email,
      })),
      invites: invites.map(
        ({
          users_company_invites_invited_user_idTousers: invited,
          ...rest
        }) => ({
          ...rest,
          invited_user: invited,
        }),
      ),
    };
  }

  /** Dono convida alguém já cadastrado, por e-mail ou CPF. */
  async invite(
    user_id: string,
    company_id: string,
    dto: CreateInviteDto,
  ): Promise<void> {
    await this.assertOwner(user_id, company_id);
    if (!dto.email === !dto.cpf) {
      throw new BadRequestException(
        'Informe quem convidar por email ou cpf (apenas um dos dois)',
      );
    }

    const invited = await this.prisma.users.findFirst({
      where: dto.email ? { email: dto.email.toLowerCase() } : { cpf: dto.cpf },
      select: { id: true, status: true },
    });
    if (!invited) throw new NotFoundException('Usuário não encontrado');
    if (invited.id === user_id) {
      throw new UnprocessableEntityException('Você já é o dono desta empresa');
    }
    if (invited.status !== 'active') {
      throw new UnprocessableEntityException('Usuário desativado');
    }
    if (await this.roleOf(invited.id, company_id)) {
      throw new ConflictException('Esta pessoa já faz parte da empresa');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.company_invites.create({
          data: {
            company_id,
            invited_user_id: invited.id,
            invited_by: user_id,
          },
          select: { id: true },
        });
        await this.audit(tx, user_id, 'company.invite', company_id, {
          invite_id: created.id,
          invited_user_id: invited.id,
        });
      });
    } catch (error) {
      // Índice único: um convite pendente por pessoa em cada empresa
      if (isUniqueViolation(error)) {
        throw new ConflictException('Esta pessoa já tem um convite pendente');
      }
      throw error;
    }
  }

  /** Dono cancela um convite que ainda não foi respondido. */
  async cancelInvite(
    user_id: string,
    company_id: string,
    invite_id: string,
  ): Promise<void> {
    await this.assertOwner(user_id, company_id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.company_invites.updateMany({
        where: { id: invite_id, company_id, status: 'pending' },
        data: { status: 'canceled', responded_at: new Date() },
      });
      if (count === 0) throw new NotFoundException('Convite não encontrado');
      await this.audit(tx, user_id, 'company.invite_cancel', company_id, {
        invite_id,
      });
    });
  }

  /** Dono tira alguém da empresa. O acesso cai na próxima requisição da pessoa. */
  async removeMember(
    user_id: string,
    company_id: string,
    member_id: string,
  ): Promise<void> {
    await this.assertOwner(user_id, company_id);
    if (member_id === user_id) {
      throw new UnprocessableEntityException(
        'O dono não pode remover a si mesmo',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.company_members.deleteMany({
        where: { company_id, user_id: member_id },
      });
      if (count === 0) throw new NotFoundException('Membro não encontrado');
      await this.audit(tx, user_id, 'company.member_remove', company_id, {
        user_id: member_id,
      });
    });
  }

  /** Membro sai da empresa. O dono não pode (a empresa ficaria sem dono). */
  async leave(user_id: string, company_id: string): Promise<void> {
    const role = await this.assertMember(user_id, company_id);
    if (role === 'owner') {
      throw new UnprocessableEntityException('O dono não pode sair da empresa');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.company_members.deleteMany({ where: { company_id, user_id } });
      await this.audit(tx, user_id, 'company.member_leave', company_id, {});
    });
  }

  private async roleOf(
    user_id: string,
    company_id: string,
  ): Promise<company_role | null> {
    const member = await this.prisma.company_members.findUnique({
      where: { company_id_user_id: { company_id, user_id } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  private async assertMember(
    user_id: string,
    company_id: string,
  ): Promise<company_role> {
    const role = await this.roleOf(user_id, company_id);
    if (!role) throw new ForbiddenException('Você não faz parte desta empresa');
    return role;
  }

  private async assertOwner(user_id: string, company_id: string) {
    const role = await this.roleOf(user_id, company_id);
    if (role !== 'owner') {
      throw new ForbiddenException('Só o dono da empresa pode fazer isso');
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor_id: string,
    action: string,
    company_id: string,
    details: Prisma.InputJsonObject,
  ) {
    return tx.audit_logs.create({
      data: {
        actor_id,
        action,
        target_type: 'company',
        target_id: company_id,
        details,
      },
    });
  }
}
