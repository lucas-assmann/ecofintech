import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import type { transaction_type } from '../../database/generated/prisma/enums.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto.js';
import { Transaction } from './entities/transaction.entity.js';

const transactionSelect = {
  id: true,
  type: true,
  category: true,
  amount: true,
  balance_after: true,
  description: true,
  reversal_of: true,
  created_at: true,
  // Relação com a conta da contraparte (nome gerado pelo db pull)
  accounts_transactions_counterparty_account_idToaccounts: {
    select: { users: { select: { name: true, email: true } } },
  },
} satisfies Prisma.transactionsSelect;

type SelectedTransaction = Prisma.transactionsGetPayload<{
  select: typeof transactionSelect;
}>;

type Client = Prisma.TransactionClient | PrismaService;

/** Movimento de saldo numa conta, dentro de uma operação. */
interface Move {
  account_id: string;
  type: transaction_type;
  amount: Prisma.Decimal;
}

/** Resultado de uma operação idempotente. */
export interface OperationResult {
  transaction: Transaction;
  /** true quando a chave já tinha sido usada e o resultado original foi devolvido */
  replayed: boolean;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Entrada de dinheiro vindo de fora (só admin). Gera um lançamento de entrada. */
  deposit(
    admin_id: string,
    idempotency_key: string,
    dto: DepositDto,
  ): Promise<OperationResult> {
    return this.runIdempotent(
      admin_id,
      idempotency_key,
      'deposit',
      dto,
      async (tx) => {
        const account_id = await findRecipientAccountId(tx, dto);
        const amount = new Prisma.Decimal(dto.amount);
        const balances = await applyMoves(
          tx,
          [{ account_id, type: 'entrada', amount }],
          'Saldo insuficiente',
        );

        const entry = await tx.transactions.create({
          data: {
            account_id,
            type: 'entrada',
            category: 'deposito',
            amount,
            balance_after: balances.get(account_id)!,
            description: dto.description,
            created_by: admin_id,
          },
          select: transactionSelect,
        });
        return toTransaction(entry);
      },
    );
  }

  /**
   * Transfere da conta do usuário logado para a conta de destino (e-mail ou CPF).
   * Gera dois lançamentos com o mesmo operation_id: saída na origem e entrada no destino.
   */
  transfer(
    user_id: string,
    idempotency_key: string,
    dto: TransferDto,
  ): Promise<OperationResult> {
    return this.runIdempotent(
      user_id,
      idempotency_key,
      'transfer',
      dto,
      async (tx) => {
        const from = await findAccountIdByUser(tx, user_id);
        const to = await findRecipientAccountId(tx, dto);
        if (from === to) {
          throw new BadRequestException(
            'Não é possível transferir para a própria conta',
          );
        }
        const amount = new Prisma.Decimal(dto.amount);
        const balances = await applyMoves(
          tx,
          [
            { account_id: from, type: 'saida', amount },
            { account_id: to, type: 'entrada', amount },
          ],
          'Saldo insuficiente',
        );

        const common = {
          category: 'transferencia' as const,
          amount,
          description: dto.description,
          created_by: user_id,
          operation_id: randomUUID(),
        };
        const outgoing = await tx.transactions.create({
          data: {
            ...common,
            account_id: from,
            type: 'saida',
            balance_after: balances.get(from)!,
            counterparty_account_id: to,
          },
          select: transactionSelect,
        });
        await tx.transactions.create({
          data: {
            ...common,
            account_id: to,
            type: 'entrada',
            balance_after: balances.get(to)!,
            counterparty_account_id: from,
          },
        });
        return toTransaction(outgoing);
      },
    );
  }

  /**
   * Estorno (só admin): lança o movimento inverso de cada ponta da operação.
   * Estornar qualquer ponta de uma transferência desfaz as duas.
   */
  async reverse(
    admin_id: string,
    id: string,
    dto: ReverseTransactionDto,
  ): Promise<Transaction[]> {
    const original = await this.prisma.transactions.findUnique({
      where: { id },
      select: { category: true, operation_id: true },
    });
    if (!original) throw new NotFoundException('Movimentação não encontrada');
    if (original.category === 'estorno') {
      throw new UnprocessableEntityException(
        'Um estorno não pode ser estornado',
      );
    }

    const legs = await this.prisma.transactions.findMany({
      where: { operation_id: original.operation_id },
      select: {
        id: true,
        account_id: true,
        type: true,
        amount: true,
        counterparty_account_id: true,
        accounts_transactions_account_idToaccounts: {
          select: { users: { select: { status: true } } },
        },
      },
    });
    // Verifica antes de mover saldo, para responder "já estornada" em vez de
    // um erro de saldo. O índice único em reversal_of continua garantindo isso
    // se dois estornos chegarem ao mesmo tempo.
    const alreadyReversed = await this.prisma.transactions.count({
      where: { reversal_of: { in: legs.map((leg) => leg.id) } },
    });
    if (alreadyReversed > 0) {
      throw new ConflictException('Esta movimentação já foi estornada');
    }
    if (
      legs.some(
        (leg) =>
          leg.accounts_transactions_account_idToaccounts.users.status !==
          'active',
      )
    ) {
      throw new UnprocessableEntityException(
        'Não é possível estornar: uma das contas está desativada',
      );
    }

    const inverse = (type: transaction_type): transaction_type =>
      type === 'entrada' ? 'saida' : 'entrada';
    const operation_id = randomUUID();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const balances = await applyMoves(
          tx,
          legs.map((leg) => ({
            account_id: leg.account_id,
            type: inverse(leg.type),
            amount: leg.amount,
          })),
          'Saldo insuficiente para o estorno',
        );

        const created: Transaction[] = [];
        for (const leg of legs) {
          const entry = await tx.transactions.create({
            data: {
              account_id: leg.account_id,
              type: inverse(leg.type),
              category: 'estorno',
              amount: leg.amount,
              balance_after: balances.get(leg.account_id)!,
              counterparty_account_id: leg.counterparty_account_id,
              description: dto.reason ?? 'Estorno',
              created_by: admin_id,
              operation_id,
              reversal_of: leg.id,
            },
            select: transactionSelect,
          });
          created.push(toTransaction(entry));
        }
        return created;
      });
    } catch (error) {
      // Índice único em reversal_of: este lançamento já tem estorno
      if (isUniqueViolation(error)) {
        throw new ConflictException('Esta movimentação já foi estornada');
      }
      throw error;
    }
  }

  /** Extrato do usuário logado, do mais recente para o mais antigo. */
  async findAll(
    user_id: string,
    query: ListTransactionsQueryDto,
  ): Promise<Transaction[]> {
    const account_id = await findAccountIdByUser(this.prisma, user_id);
    const entries = await this.prisma.transactions.findMany({
      where: { account_id },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
      select: transactionSelect,
    });
    return entries.map(toTransaction);
  }

  /** Um lançamento: o usuário vê só os da própria conta; o admin vê qualquer um. */
  async findOne(user_id: string, id: string): Promise<Transaction> {
    const user = await this.prisma.users.findUnique({
      where: { id: user_id },
      select: { role: true },
    });
    const where: Prisma.transactionsWhereInput = { id };
    if (user?.role !== 'admin') {
      where.account_id = await findAccountIdByUser(this.prisma, user_id);
    }
    const entry = await this.prisma.transactions.findFirst({
      where,
      select: transactionSelect,
    });
    if (!entry) throw new NotFoundException('Movimentação não encontrada');
    return toTransaction(entry);
  }

  /**
   * Executa uma operação no máximo uma vez por chave de idempotência.
   * Mesma chave e mesmos dados → devolve o resultado original sem repetir.
   * Mesma chave com dados diferentes → 422.
   */
  private async runIdempotent(
    user_id: string,
    key: string,
    endpoint: string,
    payload: object,
    operation: (tx: Prisma.TransactionClient) => Promise<Transaction>,
  ): Promise<OperationResult> {
    const request_hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const id = { user_id_key: { user_id, key } };

    const existing = await this.prisma.idempotency_keys.findUnique({
      where: id,
    });
    if (existing) return this.replay(existing, endpoint, request_hash);

    try {
      const transaction = await this.prisma.$transaction(async (tx) => {
        // A chave é gravada ANTES de mover o dinheiro. Uma requisição repetida
        // chegando ao mesmo tempo fica esperando nesta linha (mesma PRIMARY KEY)
        // e, quando a primeira termina, falha com P2002 e cai no replay abaixo.
        // Se a operação falhar, o ROLLBACK apaga a chave e dá para tentar de novo.
        await tx.idempotency_keys.create({
          data: { user_id, key, endpoint, request_hash },
        });
        const result = await operation(tx);
        await tx.idempotency_keys.update({
          where: id,
          data: { transaction_id: result.id },
        });
        return result;
      });
      return { transaction, replayed: false };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const concurrent = await this.prisma.idempotency_keys.findUnique({
          where: id,
        });
        if (concurrent) return this.replay(concurrent, endpoint, request_hash);
      }
      throw error;
    }
  }

  private async replay(
    existing: {
      endpoint: string;
      request_hash: string;
      transaction_id: string | null;
    },
    endpoint: string,
    request_hash: string,
  ): Promise<OperationResult> {
    if (
      existing.endpoint !== endpoint ||
      existing.request_hash !== request_hash
    ) {
      throw new UnprocessableEntityException(
        'Idempotency-Key já usada em outra operação, com dados diferentes',
      );
    }
    const entry = await this.prisma.transactions.findUniqueOrThrow({
      where: { id: existing.transaction_id! },
      select: transactionSelect,
    });
    return { transaction: toTransaction(entry), replayed: true };
  }
}

/**
 * Aplica os movimentos de saldo e devolve o saldo final de cada conta.
 * As contas são atualizadas sempre na mesma ordem (menor id primeiro): sem isso,
 * duas operações cruzadas ao mesmo tempo (A→B e B→A) podem travar uma esperando
 * a outra (deadlock).
 */
async function applyMoves(
  tx: Prisma.TransactionClient,
  moves: Move[],
  insufficientMessage: string,
): Promise<Map<string, Prisma.Decimal>> {
  const balances = new Map<string, Prisma.Decimal>();
  const ordered = [...moves].sort((a, b) =>
    a.account_id.localeCompare(b.account_id),
  );

  for (const move of ordered) {
    if (move.type === 'entrada') {
      // increment é atômico: o próprio UPDATE soma no valor atual e trava a linha
      const { balance } = await tx.accounts.update({
        where: { id: move.account_id },
        data: { balance: { increment: move.amount }, updated_at: new Date() },
        select: { balance: true },
      });
      balances.set(move.account_id, balance);
    } else {
      // Débito condicional: só atualiza se balance >= amount. Se o saldo não
      // basta, nenhuma linha bate com o where e o Prisma lança P2025.
      const { balance } = await tx.accounts
        .update({
          where: { id: move.account_id, balance: { gte: move.amount } },
          data: {
            balance: { decrement: move.amount },
            updated_at: new Date(),
          },
          select: { balance: true },
        })
        .catch((error: unknown) => {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
          ) {
            throw new UnprocessableEntityException(insufficientMessage);
          }
          throw error;
        });
      balances.set(move.account_id, balance);
    }
  }
  return balances;
}

async function findAccountIdByUser(
  client: Client,
  user_id: string,
): Promise<string> {
  const account = await client.accounts.findUnique({
    where: { user_id },
    select: { id: true },
  });
  if (!account) throw new NotFoundException('Conta não encontrada');
  return account.id;
}

/** Conta de quem vai receber, identificada por to_email ou to_cpf. */
async function findRecipientAccountId(
  client: Client,
  dto: TransferDto,
): Promise<string> {
  if (!dto.to_email === !dto.to_cpf) {
    throw new BadRequestException(
      'Informe o destinatário por to_email ou to_cpf (apenas um dos dois)',
    );
  }
  const account = await client.accounts.findFirst({
    where: {
      users: dto.to_email
        ? { email: dto.to_email.toLowerCase() }
        : { cpf: dto.to_cpf },
    },
    select: { id: true, users: { select: { status: true } } },
  });
  if (!account) throw new NotFoundException('Destinatário não encontrado');
  if (account.users.status !== 'active') {
    throw new UnprocessableEntityException('Conta de destino desativada');
  }
  return account.id;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function toTransaction(entry: SelectedTransaction): Transaction {
  const {
    accounts_transactions_counterparty_account_idToaccounts: counterparty,
    ...rest
  } = entry;
  return {
    ...rest,
    amount: entry.amount.toFixed(2),
    balance_after: entry.balance_after.toFixed(2),
    counterparty: counterparty?.users ?? null,
  };
}
