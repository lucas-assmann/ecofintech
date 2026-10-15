import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = {
    accounts: { findUnique: vi.fn() },
    company_members: { findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('devolve o saldo como texto com 2 casas', async () => {
    prisma.accounts.findUnique.mockResolvedValue({
      id: 'acc-1',
      balance: new Prisma.Decimal('200'),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const account = await service.findById('acc-1');

    expect(prisma.accounts.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acc-1' } }),
    );

    expect(account.balance).toBe('200.00');
  });

  it('lança NotFound quando a conta não existe', async () => {
    prisma.accounts.findUnique.mockResolvedValue(null);

    await expect(service.findById('acc-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('listOperable', () => {
    const company = (name: string, role: string, cnpj: string) => ({
      role,
      companies: {
        id: `company-${name}`,
        cnpj,
        trade_name: name,
        accounts: { id: `acc-${name}`, balance: new Prisma.Decimal('10') },
      },
    });

    it('conta pessoal primeiro, depois as empresas ativas por nome, com papel e documento', async () => {
      prisma.accounts.findUnique.mockResolvedValue({
        id: 'acc-pessoal',
        balance: new Prisma.Decimal('5018.7'),
        users: { name: 'Maria Silva', cpf: '52998224725' },
      });
      prisma.company_members.findMany.mockResolvedValue([
        company('Zeta', 'member', '11222333000181'),
        company('Alfa', 'owner', '00000000000191'),
      ]);

      const accounts = await service.listOperable('user-1');

      expect(accounts).toEqual([
        {
          id: 'acc-pessoal',
          kind: 'personal',
          name: 'Maria Silva',
          document: '52998224725',
          balance: '5018.70',
          role: null,
          company_id: null,
        },
        {
          id: 'acc-Alfa',
          kind: 'company',
          name: 'Alfa',
          document: '00000000000191',
          balance: '10.00',
          role: 'owner',
          company_id: 'company-Alfa',
        },
        expect.objectContaining({ name: 'Zeta', role: 'member' }),
      ]);
    });

    it('só busca empresas ativas das quais o usuário é membro', async () => {
      prisma.accounts.findUnique.mockResolvedValue({
        id: 'acc-pessoal',
        balance: new Prisma.Decimal('0'),
        users: { name: 'Maria', cpf: '52998224725' },
      });
      prisma.company_members.findMany.mockResolvedValue([]);

      await service.listOperable('user-1');

      expect(prisma.company_members.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1', companies: { status: 'active' } },
        }),
      );
    });
  });
});
