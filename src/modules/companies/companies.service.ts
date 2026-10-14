import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { OperableAccount } from '../accounts/entities/operable-account.entity.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Este CNPJ já está cadastrado');
      }
      throw error;
    }
  }
}
