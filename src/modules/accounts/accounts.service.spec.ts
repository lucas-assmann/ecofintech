import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = { accounts: { findUnique: vi.fn() } };

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

    const account = await service.findByUser('user-1');

    expect(account.balance).toBe('200.00');
  });

  it('lança NotFound quando o usuário não tem conta', async () => {
    prisma.accounts.findUnique.mockResolvedValue(null);

    await expect(service.findByUser('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
