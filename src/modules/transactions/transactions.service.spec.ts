import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { TransactionsService } from './transactions.service.js';

const D = (value: string) => new Prisma.Decimal(value);
const KEY = '11111111-1111-4111-8111-111111111111';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

const entry = (overrides: object = {}) => ({
  id: 'tx-1',
  type: 'saida',
  category: 'transferencia',
  amount: D('50'),
  balance_after: D('150'),
  description: null,
  reversal_of: null,
  created_at: new Date(),
  accounts_transactions_counterparty_account_idToaccounts: {
    users: { name: 'Fulano', email: 'fulano@email.com' },
  },
  ...overrides,
});

type DataArg = { data: Record<string, unknown> };
const createdData = (mock: { mock: { calls: unknown[][] } }) =>
  mock.mock.calls.map(([arg]) => (arg as DataArg).data);

describe('TransactionsService', () => {
  let service: TransactionsService;
  const tx = {
    idempotency_keys: { create: vi.fn(), update: vi.fn() },
    accounts: { update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    transactions: { create: vi.fn() },
  };
  const prisma = {
    idempotency_keys: { findUnique: vi.fn() },
    accounts: { findUnique: vi.fn() },
    users: { findUnique: vi.fn() },
    transactions: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };

  const sender = (id: string) =>
    tx.accounts.findUnique.mockResolvedValue({ id });
  const recipient = (id: string, status = 'active') =>
    tx.accounts.findFirst.mockResolvedValue({ id, users: { status } });

  beforeEach(async () => {
    vi.resetAllMocks();
    // Simula o $transaction do Prisma: executa o callback com o client da transação
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    prisma.idempotency_keys.findUnique.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('deposit', () => {
    const dto = { to_email: 'Maria@Email.com', amount: 200 };

    it('soma no saldo, registra o admin e guarda a chave de idempotência', async () => {
      recipient('acc-b');
      tx.accounts.update.mockResolvedValue({ balance: D('200') });
      tx.transactions.create.mockResolvedValue(
        entry({
          id: 'tx-dep',
          type: 'entrada',
          category: 'deposito',
          amount: D('200'),
          balance_after: D('200'),
          accounts_transactions_counterparty_account_idToaccounts: null,
        }),
      );

      const result = await service.deposit('admin-1', KEY, dto);

      expect(tx.accounts.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { users: { email: 'maria@email.com' } },
        }),
      );
      expect(createdData(tx.transactions.create)[0]).toMatchObject({
        type: 'entrada',
        category: 'deposito',
        created_by: 'admin-1',
      });
      expect(tx.idempotency_keys.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'admin-1',
          key: KEY,
          endpoint: 'deposit',
        }) as unknown,
      });
      expect(tx.idempotency_keys.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { transaction_id: 'tx-dep' } }),
      );
      expect(result).toMatchObject({
        replayed: false,
        transaction: { amount: '200.00', counterparty: null },
      });
    });

    it('lança NotFound quando o destinatário não existe', async () => {
      tx.accounts.findFirst.mockResolvedValue(null);

      await expect(
        service.deposit('admin-1', KEY, { to_email: 'x@x.com', amount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('idempotência', () => {
    const dto = { to_email: 'fulano@email.com', amount: 50 };

    async function hashOf(payload: object) {
      const { createHash } = await import('node:crypto');
      return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }

    it('mesma chave e mesmos dados: devolve o original sem mover dinheiro', async () => {
      prisma.idempotency_keys.findUnique.mockResolvedValue({
        endpoint: 'transfer',
        request_hash: await hashOf({ ...dto, from_account_id: 'acc-a' }),
        transaction_id: 'tx-1',
      });
      prisma.transactions.findUniqueOrThrow.mockResolvedValue(entry());

      const result = await service.transfer('user-a', 'acc-a', KEY, dto);

      expect(result.replayed).toBe(true);
      expect(result.transaction.id).toBe('tx-1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('mesma chave e mesmos dados, mas de outra conta: 422 (nunca devolve a operação da outra conta)', async () => {
      prisma.idempotency_keys.findUnique.mockResolvedValue({
        endpoint: 'transfer',
        request_hash: await hashOf({ ...dto, from_account_id: 'acc-a' }),
        transaction_id: 'tx-1',
      });

      await expect(
        service.transfer('user-a', 'acc-empresa', KEY, dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.transactions.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('mesma chave com dados diferentes: 422', async () => {
      prisma.idempotency_keys.findUnique.mockResolvedValue({
        endpoint: 'transfer',
        request_hash: await hashOf({
          ...dto,
          amount: 999,
          from_account_id: 'acc-a',
        }),
        transaction_id: 'tx-1',
      });

      await expect(
        service.transfer('user-a', 'acc-a', KEY, dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('requisição repetida em paralelo: a segunda devolve o resultado da primeira', async () => {
      // 1ª consulta: chave ainda não existe; depois do conflito, já existe
      prisma.idempotency_keys.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          endpoint: 'transfer',
          request_hash: await hashOf({ ...dto, from_account_id: 'acc-a' }),
          transaction_id: 'tx-1',
        });
      prisma.$transaction.mockRejectedValue(prismaError('P2002'));
      prisma.transactions.findUniqueOrThrow.mockResolvedValue(entry());

      const result = await service.transfer('user-a', 'acc-a', KEY, dto);

      expect(result.replayed).toBe(true);
    });
  });

  describe('transfer', () => {
    const dto = { to_email: 'fulano@email.com', amount: 50 };

    it('não permite transferir para a própria conta', async () => {
      sender('acc-a');
      recipient('acc-a');

      await expect(
        service.transfer('user-a', 'acc-a', KEY, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.accounts.update).not.toHaveBeenCalled();
    });

    it('debita a conta ativa recebida (não procura a conta pessoal do usuário)', async () => {
      recipient('acc-b');
      tx.accounts.update.mockResolvedValue({ balance: D('0') });
      tx.transactions.create.mockResolvedValue(entry());

      await service.transfer('user-a', 'acc-empresa', KEY, {
        to_email: 'fulano@email.com',
        amount: 50,
      });

      expect(tx.accounts.findUnique).not.toHaveBeenCalled();
      expect(tx.accounts.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-empresa', balance: { gte: D('50') } },
        }),
      );
      const [outgoing] = createdData(tx.transactions.create);
      expect(outgoing).toMatchObject({
        account_id: 'acc-empresa',
        type: 'saida',
        created_by: 'user-a',
      });
    });

    it('cria saída e entrada com o mesmo operation_id e o remetente como autor', async () => {
      sender('acc-a');
      recipient('acc-b');
      tx.accounts.update
        .mockResolvedValueOnce({ balance: D('150') }) // débito em acc-a
        .mockResolvedValueOnce({ balance: D('50') }); // crédito em acc-b
      tx.transactions.create.mockResolvedValueOnce(entry());

      const result = await service.transfer('user-a', 'acc-a', KEY, dto);

      const [outgoing, incoming] = createdData(tx.transactions.create);
      expect(outgoing).toMatchObject({
        account_id: 'acc-a',
        type: 'saida',
        counterparty_account_id: 'acc-b',
        balance_after: D('150'),
        created_by: 'user-a',
      });
      expect(incoming).toMatchObject({
        account_id: 'acc-b',
        type: 'entrada',
        counterparty_account_id: 'acc-a',
        balance_after: D('50'),
        created_by: 'user-a',
      });
      expect(outgoing.operation_id).toBeDefined();
      expect(incoming.operation_id).toBe(outgoing.operation_id);
      expect(result.transaction).toMatchObject({
        type: 'saida',
        amount: '50.00',
      });
    });

    it('trava as contas em ordem de id (credita antes quando o destino tem id menor)', async () => {
      sender('acc-z');
      recipient('acc-a');
      tx.accounts.update.mockResolvedValue({ balance: D('0') });
      tx.transactions.create.mockResolvedValue(entry());

      await service.transfer('user-z', 'acc-z', KEY, dto);

      const updatedIds = tx.accounts.update.mock.calls.map(
        ([arg]) => (arg as { where: { id: string } }).where.id,
      );
      expect(updatedIds).toEqual(['acc-a', 'acc-z']);
    });

    it('encontra o destinatário pelo CPF', async () => {
      sender('acc-a');
      recipient('acc-b');
      tx.accounts.update.mockResolvedValue({ balance: D('0') });
      tx.transactions.create.mockResolvedValue(entry());

      await service.transfer('user-a', 'acc-a', KEY, {
        to_cpf: '52998224725',
        amount: 50,
      });

      expect(tx.accounts.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { users: { cpf: '52998224725' } } }),
      );
    });

    it.each([
      ['nenhum dos dois', { amount: 50 }],
      [
        'os dois',
        { to_email: 'fulano@email.com', to_cpf: '52998224725', amount: 50 },
      ],
    ])('exige to_email ou to_cpf (recusa %s)', async (_caso, body) => {
      sender('acc-a');

      await expect(
        service.transfer('user-a', 'acc-a', KEY, body),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('não transfere para conta desativada', async () => {
      sender('acc-a');
      recipient('acc-b', 'deactivated');

      await expect(
        service.transfer('user-a', 'acc-a', KEY, dto),
      ).rejects.toThrow('Conta de destino desativada');
      expect(tx.accounts.update).not.toHaveBeenCalled();
    });

    it('lança "Saldo insuficiente" e não cria lançamentos', async () => {
      sender('acc-a');
      recipient('acc-b');
      tx.accounts.update.mockRejectedValueOnce(prismaError('P2025'));

      await expect(
        service.transfer('user-a', 'acc-a', KEY, dto),
      ).rejects.toThrow('Saldo insuficiente');
      expect(tx.transactions.create).not.toHaveBeenCalled();
    });
  });

  describe('reverse', () => {
    const leg = (id: string, account_id: string, type: string) => ({
      id,
      account_id,
      type,
      amount: D('50'),
      counterparty_account_id: account_id === 'acc-a' ? 'acc-b' : 'acc-a',
      accounts_transactions_account_idToaccounts: {
        users: { status: 'active' },
      },
    });

    it('estorna as duas pontas da transferência com movimentos inversos', async () => {
      prisma.transactions.findUnique.mockResolvedValue({
        category: 'transferencia',
        operation_id: 'op-1',
      });
      prisma.transactions.findMany.mockResolvedValue([
        leg('tx-out', 'acc-a', 'saida'),
        leg('tx-in', 'acc-b', 'entrada'),
      ]);
      tx.accounts.update.mockResolvedValue({ balance: D('100') });
      tx.transactions.create.mockResolvedValue(entry({ category: 'estorno' }));

      const result = await service.reverse('admin-1', 'tx-in', {
        reason: 'Fraude',
      });

      const created = createdData(tx.transactions.create);
      expect(created).toEqual([
        expect.objectContaining({
          account_id: 'acc-a',
          type: 'entrada', // devolve para quem enviou
          category: 'estorno',
          reversal_of: 'tx-out',
          created_by: 'admin-1',
          description: 'Fraude',
        }),
        expect.objectContaining({
          account_id: 'acc-b',
          type: 'saida', // retira de quem recebeu
          category: 'estorno',
          reversal_of: 'tx-in',
          created_by: 'admin-1',
        }),
      ]);
      expect(created[0].operation_id).toBe(created[1].operation_id);
      expect(result).toHaveLength(2);
    });

    it('não estorna um estorno', async () => {
      prisma.transactions.findUnique.mockResolvedValue({
        category: 'estorno',
        operation_id: 'op-2',
      });

      await expect(
        service.reverse('admin-1', 'tx-est', {}),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('não estorna duas vezes (responde 409 antes de mexer no saldo)', async () => {
      prisma.transactions.findUnique.mockResolvedValue({
        category: 'deposito',
        operation_id: 'op-3',
      });
      prisma.transactions.findMany.mockResolvedValue([
        leg('tx-dep', 'acc-b', 'entrada'),
      ]);
      prisma.transactions.count.mockResolvedValue(1);

      await expect(
        service.reverse('admin-1', 'tx-dep', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('não estorna duas vezes (dois estornos simultâneos: índice único)', async () => {
      prisma.transactions.findUnique.mockResolvedValue({
        category: 'deposito',
        operation_id: 'op-3',
      });
      prisma.transactions.findMany.mockResolvedValue([
        leg('tx-dep', 'acc-b', 'entrada'),
      ]);
      prisma.$transaction.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.reverse('admin-1', 'tx-dep', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('não estorna quando uma das contas está desativada', async () => {
      prisma.transactions.findUnique.mockResolvedValue({
        category: 'deposito',
        operation_id: 'op-4',
      });
      prisma.transactions.findMany.mockResolvedValue([
        {
          ...leg('tx-dep', 'acc-b', 'entrada'),
          accounts_transactions_account_idToaccounts: {
            users: { status: 'deactivated' },
          },
        },
      ]);

      await expect(service.reverse('admin-1', 'tx-dep', {})).rejects.toThrow(
        'desativada',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lança NotFound para lançamento inexistente', async () => {
      prisma.transactions.findUnique.mockResolvedValue(null);

      await expect(
        service.reverse('admin-1', 'tx-x', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('usuário comum só vê lançamentos da própria conta', async () => {
      prisma.users.findUnique.mockResolvedValue({ role: 'user' });
      prisma.transactions.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('user-a', 'acc-a', 'tx-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transactions.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-x', account_id: 'acc-a' } }),
      );
    });

    it('admin vê qualquer lançamento', async () => {
      prisma.users.findUnique.mockResolvedValue({ role: 'admin' });
      prisma.transactions.findFirst.mockResolvedValue(entry());

      await service.findOne('admin-1', 'acc-admin', 'tx-1');

      expect(prisma.transactions.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-1' } }),
      );
    });
  });

  describe('findAllAdmin', () => {
    const page = { limit: 50, offset: 0 };
    const whereArg = () =>
      (
        prisma.transactions.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;

    it('devolve os lançamentos com o dono da conta', async () => {
      prisma.transactions.findMany.mockResolvedValue([
        entry({
          accounts_transactions_account_idToaccounts: {
            users: { name: 'Beltrano', email: 'beltrano@email.com' },
          },
        }),
      ]);

      const [result] = await service.findAllAdmin(page);

      expect(result).toMatchObject({
        id: 'tx-1',
        amount: '50.00',
        owner: { name: 'Beltrano', email: 'beltrano@email.com' },
        counterparty: { name: 'Fulano', email: 'fulano@email.com' },
      });
      expect(result).not.toHaveProperty(
        'accounts_transactions_account_idToaccounts',
      );
    });

    it('converte o período em dias inteiros no horário de Brasília', async () => {
      prisma.transactions.findMany.mockResolvedValue([]);

      await service.findAllAdmin({
        ...page,
        from: '2026-10-01',
        to: '2026-10-31',
      });

      expect(whereArg().created_at).toEqual({
        gte: new Date('2026-10-01T03:00:00Z'),
        lt: new Date('2026-11-01T03:00:00Z'),
      });
    });

    it('busca por nome, e-mail ou CPF (ignorando pontuação do CPF)', async () => {
      prisma.transactions.findMany.mockResolvedValue([]);

      await service.findAllAdmin({ ...page, search: ' 123.456 ' });

      expect(whereArg().accounts_transactions_account_idToaccounts).toEqual({
        users: {
          OR: [
            { name: { contains: '123.456', mode: 'insensitive' } },
            { email: { contains: '123.456', mode: 'insensitive' } },
            { cpf: { contains: '123456' } },
          ],
        },
      });
    });

    it('sem dígitos na busca, não filtra por CPF', async () => {
      prisma.transactions.findMany.mockResolvedValue([]);

      await service.findAllAdmin({ ...page, search: 'fulano' });

      const filter = whereArg().accounts_transactions_account_idToaccounts as {
        users: { OR: unknown[] };
      };
      expect(filter.users.OR).toHaveLength(2);
    });
  });

  describe('summary', () => {
    const mockQueries = (
      series: { date: string; entradas: string; saidas: string }[],
    ) => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ from: '2026-10-07', to: '2026-10-13' }])
        .mockResolvedValueOnce(
          series.map((row) => ({
            date: row.date,
            entradas: D(row.entradas),
            saidas: D(row.saidas),
          })),
        )
        .mockResolvedValueOnce([
          { category: 'deposito', type: 'entrada', total: D('100'), count: 1 },
        ]);
    };

    it('soma os intervalos e calcula o resultado (pode ser negativo)', async () => {
      mockQueries([
        { date: '2026-10-07', entradas: '100', saidas: '0' },
        { date: '2026-10-08', entradas: '0', saidas: '150.5' },
      ]);

      const result = await service.summary('acc-a', { days: 7 });

      expect(result).toMatchObject({
        from: '2026-10-07',
        to: '2026-10-13',
        bucket: 'day',
        total_entradas: '100.00',
        total_saidas: '150.50',
        resultado: '-50.50',
        series: [
          { date: '2026-10-07', entradas: '100.00', saidas: '0.00' },
          { date: '2026-10-08', entradas: '0.00', saidas: '150.50' },
        ],
        by_category: [
          { category: 'deposito', type: 'entrada', total: '100.00', count: 1 },
        ],
      });
    });

    it('agrupa por semana no período de 90 dias', async () => {
      mockQueries([]);

      const result = await service.summary('acc-a', { days: 90 });

      expect(result.bucket).toBe('week');
      expect(result.resultado).toBe('0.00');
    });
  });
});
