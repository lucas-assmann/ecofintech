import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { TransactionsService } from './transactions.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto.js';
import { Transaction } from './entities/transaction.entity.js';

// Movimentações são imutáveis: não há rotas para editar nem apagar.
@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('deposit')
  @Roles('admin')
  @ApiOperation({
    summary: 'Deposita na conta de um usuário (somente admin)',
  })
  @ApiCreatedResponse({ type: Transaction })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  @ApiNotFoundResponse({ description: 'Destinatário não encontrado' })
  deposit(@Body() depositDto: DepositDto) {
    return this.transactionsService.deposit(depositDto);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfere do usuário logado para outro usuário (pelo e-mail)',
  })
  @ApiCreatedResponse({
    type: Transaction,
    description: 'Lançamento de saída na conta de quem enviou',
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos ou transferência para a própria conta',
  })
  @ApiNotFoundResponse({ description: 'Destinatário não encontrado' })
  @ApiUnprocessableEntityResponse({ description: 'Saldo insuficiente' })
  transfer(@CurrentUser() user: JwtPayload, @Body() transferDto: TransferDto) {
    return this.transactionsService.transfer(user.sub, transferDto);
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

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um lançamento do usuário logado' })
  @ApiOkResponse({ type: Transaction })
  @ApiNotFoundResponse({ description: 'Movimentação não encontrada' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(user.sub, id);
  }
}
