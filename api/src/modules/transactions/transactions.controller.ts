import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  ApiIdempotencyKey,
  IdempotencyKey,
} from '../../common/decorators/idempotency-key.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import {
  ActiveAccount,
  ApiActiveAccount,
} from '../../common/decorators/active-account.decorator.js';
import type { ActiveAccountContext } from '../accounts/account-access.service.js';
import {
  OperationResult,
  TransactionsService,
} from './transactions.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto.js';
import { ListAllTransactionsQueryDto } from './dto/list-all-transactions.query.dto.js';
import { SummaryQueryDto } from './dto/summary.query.dto.js';
import {
  AdminTransaction,
  Transaction,
} from './entities/transaction.entity.js';
import { TransactionSummary } from './entities/transaction-summary.entity.js';

// Movimentações são imutáveis: não há rotas para editar nem apagar.
// Correções são feitas por estorno.
@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('deposit')
  @Roles('admin')
  @ApiIdempotencyKey()
  @ApiOperation({
    summary: 'Deposita na conta de um usuário (somente admin)',
  })
  @ApiCreatedResponse({ type: Transaction })
  @ApiBadRequestResponse({ description: 'Dados ou Idempotency-Key inválidos' })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  @ApiNotFoundResponse({ description: 'Destinatário não encontrado' })
  @ApiUnprocessableEntityResponse({
    description:
      'Conta de destino desativada ou Idempotency-Key reutilizada com outros dados',
  })
  async deposit(
    @CurrentUser() admin: JwtPayload,
    @IdempotencyKey() key: string,
    @Body() depositDto: DepositDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withReplayHeader(
      res,
      await this.transactionsService.deposit(admin.sub, key, depositDto),
    );
  }

  @Post('transfer')
  @ApiIdempotencyKey()
  @ApiActiveAccount()
  @ApiOperation({
    summary:
      'Transfere do usuário logado para outro usuário (por e-mail ou CPF)',
  })
  @ApiCreatedResponse({
    type: Transaction,
    description: 'Lançamento de saída na conta de quem enviou',
  })
  @ApiBadRequestResponse({
    description:
      'Dados inválidos, transferência para a própria conta ou Idempotency-Key ausente',
  })
  @ApiNotFoundResponse({ description: 'Destinatário não encontrado' })
  @ApiUnprocessableEntityResponse({
    description:
      'Saldo insuficiente, conta de destino desativada ou Idempotency-Key reutilizada com outros dados',
  })
  async transfer(
    @CurrentUser() user: JwtPayload,
    @ActiveAccount() account: ActiveAccountContext,
    @IdempotencyKey() key: string,
    @Body() transferDto: TransferDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withReplayHeader(
      res,
      await this.transactionsService.transfer(
        user.sub,
        account.account_id,
        key,
        transferDto,
      ),
    );
  }

  @Post(':id/reverse')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Estorna um lançamento (somente admin). Em transferências, desfaz as duas pontas',
  })
  @ApiCreatedResponse({
    type: [Transaction],
    description: 'Lançamentos de estorno criados',
  })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  @ApiNotFoundResponse({ description: 'Movimentação não encontrada' })
  @ApiConflictResponse({ description: 'Movimentação já estornada' })
  @ApiUnprocessableEntityResponse({
    description:
      'Saldo insuficiente para o estorno, conta desativada ou tentativa de estornar um estorno',
  })
  reverse(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseTransactionDto,
  ) {
    return this.transactionsService.reverse(admin.sub, id, dto);
  }

  @Get()
  @ApiActiveAccount()
  @ApiOperation({
    summary: 'Extrato da conta ativa (mais recentes primeiro)',
  })
  @ApiOkResponse({ type: [Transaction] })
  findAll(
    @ActiveAccount() account: ActiveAccountContext,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(account.account_id, query);
  }

  // As rotas fixas (summary, all) precisam vir antes de GET :id,
  // senão "summary" e "all" seriam lidos como um id
  @Get('summary')
  @ApiActiveAccount()
  @ApiOperation({
    summary:
      'Resumo de entradas e saídas da conta ativa no período (dashboard)',
  })
  @ApiOkResponse({ type: TransactionSummary })
  @ApiBadRequestResponse({ description: 'Período inválido (use 7, 30 ou 90)' })
  summary(
    @ActiveAccount() account: ActiveAccountContext,
    @Query() query: SummaryQueryDto,
  ) {
    return this.transactionsService.summary(account.account_id, query);
  }

  @Get('all')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Todos os lançamentos do sistema, com filtros (somente admin, mais recentes primeiro)',
  })
  @ApiOkResponse({ type: [AdminTransaction] })
  @ApiBadRequestResponse({ description: 'Filtro inválido' })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  findAllAdmin(@Query() query: ListAllTransactionsQueryDto) {
    return this.transactionsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiActiveAccount()
  @ApiOperation({
    summary:
      'Detalhe de um lançamento (usuário: só da conta ativa; admin: qualquer um)',
  })
  @ApiOkResponse({ type: Transaction })
  @ApiNotFoundResponse({ description: 'Movimentação não encontrada' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @ActiveAccount() account: ActiveAccountContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(user.sub, account.account_id, id);
  }
}

// Em uma repetição (mesma Idempotency-Key), avisa o cliente pelo header
function withReplayHeader(res: Response, result: OperationResult) {
  if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
  return result.transaction;
}
