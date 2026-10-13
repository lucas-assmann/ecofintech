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
  OperationResult,
  TransactionsService,
} from './transactions.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto.js';
import { ListAllTransactionsQueryDto } from './dto/list-all-transactions.query.dto.js';
import {
  AdminTransaction,
  Transaction,
} from './entities/transaction.entity.js';

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
    @IdempotencyKey() key: string,
    @Body() transferDto: TransferDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withReplayHeader(
      res,
      await this.transactionsService.transfer(user.sub, key, transferDto),
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
  @ApiOperation({
    summary: 'Extrato do usuário logado (mais recentes primeiro)',
  })
  @ApiOkResponse({ type: [Transaction] })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(user.sub, query);
  }

  // Precisa vir antes de GET :id, senão "all" seria lido como um id
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
  @ApiOperation({
    summary:
      'Detalhe de um lançamento (usuário: só da própria conta; admin: qualquer um)',
  })
  @ApiOkResponse({ type: Transaction })
  @ApiNotFoundResponse({ description: 'Movimentação não encontrada' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(user.sub, id);
  }
}

// Em uma repetição (mesma Idempotency-Key), avisa o cliente pelo header
function withReplayHeader(res: Response, result: OperationResult) {
  if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
  return result.transaction;
}
