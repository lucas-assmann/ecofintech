import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto.js';
import { Transaction } from './entities/transaction.entity.js';

const transactionSelect = {
  id: true,
  type: true,
  category: true,
  amount: true,
  balance_after: true,
  description: true,
  created_at: true,
  // Relação com a conta da contraparte (nome gerado pelo db pull)
  accounts_transactions_counterparty_account_idToaccounts: {
    select: { users: { select: { name: true, email: true } } },
  },
} satisfies Prisma.transactionsSelect;

type SelectedTransaction = Prisma.transactionsGetPayload<{
  select: typeof transactionSelect;
}>;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Entrada de dinheiro vindo de fora (só admin). Gera um lançamento de entrada. */
  async deposit(dto: DepositDto): Promise<Transaction> {
    const account_id = await this.findAccountIdByEmail(dto.to_email);
    const amount = new Prisma.Decimal(dto.amount);

    // $transaction: tudo dentro roda numa transação do banco (BEGIN/COMMIT).
    // Se algo falhar, nada é gravado (ROLLBACK).
    return this.prisma.$transaction(async (tx) => {
      // increment é atômico: o próprio UPDATE soma no valor atual e trava a linha
      const account = await tx.accounts.update({
        where: { id: account_id },
        data: { balance: { increment: amount }, updated_at: new Date() },
        select: { balance: true },
      });

      const entry = await tx.transactions.create({
        data: {
          account_id,
          type: 'entrada',
          category: 'deposito',
          amount,
          balance_after: account.balance,
          description: dto.description,
        },
        select: transactionSelect,
      });
      return toTransaction(entry);
    });
  }

  /**
   * Transfere da conta do usuário logado para a conta do e-mail informado.
   * Gera dois lançamentos: saída na origem e entrada no destino.
   */
  async transfer(user_id: string, dto: TransferDto): Promise<Transaction> {
    const from = await this.findAccountIdByUser(user_id);
    const to = await this.findAccountIdByEmail(dto.to_email);
    if (from === to) {
      throw new BadRequestException(
        'Não é possível transferir para a própria conta',
      );
    }
    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      // Débito condicional: só atualiza se balance >= amount. Se o saldo não
      // basta, nenhuma linha bate com o where e o Prisma lança P2025.
      const debit = () =>
        tx.accounts
          .update({
            where: { id: from, balance: { gte: amount } },
            data: { balance: { decrement: amount }, updated_at: new Date() },
            select: { balance: true },
          })
          .catch((error: unknown) => {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2025'
            ) {
              throw new UnprocessableEntityException('Saldo insuficiente');
            }
            throw error;
          });

      const credit = () =>
        tx.accounts.update({
          where: { id: to },
          data: { balance: { increment: amount }, updated_at: new Date() },
          select: { balance: true },
        });

      // As duas contas são travadas sempre na mesma ordem (menor id primeiro).
      // Sem isso, A→B e B→A ao mesmo tempo podem travar uma esperando a outra (deadlock).
      let fromBalance: Prisma.Decimal;
      let toBalance: Prisma.Decimal;
      if (from < to) {
        fromBalance = (await debit()).balance;
        toBalance = (await credit()).balance;
      } else {
        toBalance = (await credit()).balance;
        fromBalance = (await debit()).balance;
      }

      const outgoing = await tx.transactions.create({
        data: {
          account_id: from,
          type: 'saida',
          category: 'transferencia',
          amount,
          balance_after: fromBalance,
          counterparty_account_id: to,
          description: dto.description,
        },
        select: transactionSelect,
      });
      await tx.transactions.create({
        data: {
          account_id: to,
          type: 'entrada',
          category: 'transferencia',
          amount,
          balance_after: toBalance,
          counterparty_account_id: from,
          description: dto.description,
        },
      });

      return toTransaction(outgoing);
    });
  }

  /** Extrato do usuário logado, do mais recente para o mais antigo. */
  async findAll(
    user_id: string,
    query: ListTransactionsQueryDto,
  ): Promise<Transaction[]> {
    const account_id = await this.findAccountIdByUser(user_id);
    const entries = await this.prisma.transactions.findMany({
      where: { account_id },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
      select: transactionSelect,
    });
    return entries.map(toTransaction);
  }

  /** Um lançamento, desde que seja da conta do usuário logado. */
  async findOne(user_id: string, id: string): Promise<Transaction> {
    const account_id = await this.findAccountIdByUser(user_id);
    const entry = await this.prisma.transactions.findFirst({
      where: { id, account_id },
      select: transactionSelect,
    });
    if (!entry) throw new NotFoundException('Movimentação não encontrada');
    return toTransaction(entry);
  }

  private async findAccountIdByUser(user_id: string): Promise<string> {
    const account = await this.prisma.accounts.findUnique({
      where: { user_id },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account.id;
  }

  private async findAccountIdByEmail(email: string): Promise<string> {
    const account = await this.prisma.accounts.findFirst({
      where: { users: { email: email.toLowerCase() } },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Destinatário não encontrado');
    return account.id;
  }
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
