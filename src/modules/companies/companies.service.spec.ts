import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { CompaniesService } from './companies.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

describe('CompaniesService', () => {
  let service: CompaniesService;
  const tx = {
    companies: { create: vi.fn() },
    audit_logs: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CompaniesService);
  });

  describe('create', () => {
    const dto = {
      cnpj: '11222333000181',
      legal_name: 'Pão Bom Comércio de Alimentos LTDA',
      trade_name: 'Padaria Pão Bom',
    };

    it('cria a empresa com o usuário como dono e a conta, e registra na auditoria', async () => {
      tx.companies.create.mockResolvedValue({
        id: 'company-1',
        cnpj: dto.cnpj,
        trade_name: dto.trade_name,
        accounts: { id: 'acc-c', balance: new Prisma.Decimal('0') },
      });

      const result = await service.create('user-1', dto);

      const { data } = tx.companies.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({
        ...dto,
        created_by: 'user-1',
        company_members: { create: { user_id: 'user-1', role: 'owner' } },
        accounts: { create: {} },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor_id: 'user-1',
          action: 'company.create',
          target_type: 'company',
          target_id: 'company-1',
        }) as object,
      });
      expect(result).toEqual({
        id: 'acc-c',
        kind: 'company',
        name: 'Padaria Pão Bom',
        document: '11222333000181',
        balance: '0.00',
        role: 'owner',
        company_id: 'company-1',
      });
    });

    it('CNPJ já cadastrado: 409', async () => {
      tx.companies.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create('user-1', dto)).rejects.toThrow(
        new ConflictException('Este CNPJ já está cadastrado'),
      );
    });
  });
});
