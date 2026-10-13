import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { TransactionsService } from './transactions.service.js';

const D = (value: string) => new Prisma.Decimal(value);

const entry = (overrides: object = {}) => ({
  id: 'tx-1',
  type: 'saida',
  category: 'transferencia',
  amount: D('50'),
  balance_after: D('150'),
  description: null,
  created_at: new Date(),
  accounts_transactions_counterparty_account_idToaccounts: {
    users: { name: 'Fulano', email: 'fulano@email.com' },
  },
  ...overrides,
});

describe('TransactionsService', () => {
  let service: TransactionsService;
  const tx = {
    accounts: { update: vi.fn() },
    transactions: { create: vi.fn() },
  };
  const prisma = {
    accounts: { findUnique: vi.fn(), findFirst: vi.fn() },
    transactions: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    // Simula o $transaction do Prisma: executa o callback com o client da transação
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('deposit', () => {
    it('soma no saldo e cria um lançamento de entrada', async () => {
      prisma.accounts.findFirst.mockResolvedValue({ id: 'acc-b' });
      tx.accounts.update.mockResolvedValue({ balance: D('200') });
      tx.transactions.create.mockResolvedValue(
        entry({
          type: 'entrada',
          category: 'deposito',
          amount: D('200'),
          balance_after: D('200'),
          accounts_transactions_counterparty_account_idToaccounts: null,
        }),
      );

      const result = await service.deposit({
        to_email: 'Maria@Email.com',
        amount: 200,
      });

      expect(prisma.accounts.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { users: { email: 'maria@email.com' } },
        }),
      );
      const { data } = tx.transactions.create.mock.calls[0][0] as {
        data: { type: string; category: string; balance_after: unknown };
      };
      expect(data).toMatchObject({ type: 'entrada', category: 'deposito' });
      expect(result).toMatchObject({
        amount: '200.00',
        balance_after: '200.00',
        counterparty: null,
      });
    });

    it('lança NotFound quando o e-mail não existe', async () => {
      prisma.accounts.findFirst.mockResolvedValue(null);

      await expect(
        service.deposit({ to_email: 'ninguem@email.com', amount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('transfer', () => {
    const dto = { to_email: 'fulano@email.com', amount: 50 };

    function accounts(from: string, to: string) {
      prisma.accounts.findUnique.mockResolvedValue({ id: from });
      prisma.accounts.findFirst.mockResolvedValue({ id: to });
    }

    it('não permite transferir para a própria conta', async () => {
      accounts('acc-a', 'acc-a');

      await expect(service.transfer('user-a', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cria saída na origem e entrada no destino', async () => {
      accounts('acc-a', 'acc-b');
      tx.accounts.update
        .mockResolvedValueOnce({ balance: D('150') }) // débito em acc-a
        .mockResolvedValueOnce({ balance: D('50') }); // crédito em acc-b
      tx.transactions.create.mockResolvedValueOnce(entry());

      const result = await service.transfer('user-a', dto);

      const created = tx.transactions.create.mock.calls.map(
        ([arg]) => (arg as { data: Record<string, unknown> }).data,
      );
      expect(created[0]).toMatchObject({
        account_id: 'acc-a',
        type: 'saida',
        counterparty_account_id: 'acc-b',
        balance_after: D('150'),
      });
      expect(created[1]).toMatchObject({
        account_id: 'acc-b',
        type: 'entrada',
        counterparty_account_id: 'acc-a',
        balance_after: D('50'),
      });
      expect(result).toMatchObject({
        type: 'saida',
        amount: '50.00',
        counterparty: { name: 'Fulano', email: 'fulano@email.com' },
      });
    });

    it('trava as contas em ordem de id (credita antes quando o destino tem id menor)', async () => {
      accounts('acc-z', 'acc-a');
      tx.accounts.update.mockResolvedValue({ balance: D('0') });
      tx.transactions.create.mockResolvedValue(entry());

      await service.transfer('user-z', dto);

      const updatedIds = tx.accounts.update.mock.calls.map(
        ([arg]) => (arg as { where: { id: string } }).where.id,
      );
      expect(updatedIds).toEqual(['acc-a', 'acc-z']);
    });

    it('lança "Saldo insuficiente" e não cria lançamentos', async () => {
      accounts('acc-a', 'acc-b');
      tx.accounts.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(service.transfer('user-a', dto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(tx.transactions.create).not.toHaveBeenCalled();
    });
  });

  it('findOne lança NotFound para lançamento de outra conta', async () => {
    prisma.accounts.findUnique.mockResolvedValue({ id: 'acc-a' });
    prisma.transactions.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user-a', 'tx-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
