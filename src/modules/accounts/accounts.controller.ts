import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ActiveAccount,
  ApiActiveAccount,
} from '../../common/decorators/active-account.decorator.js';
import type { ActiveAccountContext } from './account-access.service.js';
import { AccountsService } from './accounts.service.js';
import { Account } from './entities/account.entity.js';

// A conta é criada automaticamente no cadastro e o saldo só muda por
// movimentações, então não há rotas para criar, editar ou apagar contas.
@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  @ApiActiveAccount()
  @ApiOperation({ summary: 'Conta ativa e o seu saldo' })
  @ApiOkResponse({ type: Account })
  findMine(@ActiveAccount() account: ActiveAccountContext) {
    return this.accountsService.findById(account.account_id);
  }
}
