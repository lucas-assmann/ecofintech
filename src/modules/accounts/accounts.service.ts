import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Account } from './entities/account.entity.js';
import { OperableAccount } from './entities/operable-account.entity.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(account_id: string): Promise<Account> {
    const account = await this.prisma.accounts.findUnique({
      where: { id: account_id },
      select: { id: true, balance: true, created_at: true, updated_at: true },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return { ...account, balance: account.balance.toFixed(2) };
  }

  /** Contas que o usuário pode usar: a pessoal primeiro, depois as empresas por nome. */
  async listOperable(user_id: string): Promise<OperableAccount[]> {
    const personal = await this.prisma.accounts.findUnique({
      where: { user_id },
      select: {
        id: true,
        balance: true,
        users: { select: { name: true, cpf: true } },
      },
    });
    if (!personal) throw new NotFoundException('Conta não encontrada');

    const memberships = await this.prisma.company_members.findMany({
      where: { user_id, companies: { status: 'active' } },
      select: {
        role: true,
        companies: {
          select: {
            id: true,
            cnpj: true,
            trade_name: true,
            accounts: { select: { id: true, balance: true } },
          },
        },
      },
    });

    const companies = memberships
      // Toda empresa ganha a conta na criação; o filtro só satisfaz o tipo
      .filter(({ companies }) => companies.accounts)
      .map(({ role, companies }): OperableAccount => ({
        id: companies.accounts!.id,
        kind: 'company',
        name: companies.trade_name,
        document: companies.cnpj,
        balance: companies.accounts!.balance.toFixed(2),
        role,
        company_id: companies.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return [
      {
        id: personal.id,
        kind: 'personal',
        name: personal.users!.name,
        document: personal.users!.cpf,
        balance: personal.balance.toFixed(2),
        role: null,
        company_id: null,
      },
      ...companies,
    ];
  }
}
