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
import { OperableAccount } from './entities/operable-account.entity.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';

// A conta é criada automaticamente no cadastro e o saldo só muda por
// movimentações, então não há rotas para criar, editar ou apagar contas.
@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Contas que o usuário pode usar (pessoal e empresas), para escolher com qual operar',
  })
  @ApiOkResponse({ type: [OperableAccount] })
  listOperable(@CurrentUser() user: JwtPayload) {
    return this.accountsService.listOperable(user.sub);
  }

  @Get('me')
  @ApiActiveAccount()
  @ApiOperation({ summary: 'Conta ativa e o seu saldo' })
  @ApiOkResponse({ type: Account })
  findMine(@ActiveAccount() account: ActiveAccountContext) {
    return this.accountsService.findById(account.account_id);
  }
}
