import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
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
  @ApiOperation({ summary: 'Conta e saldo do usuário logado' })
  @ApiOkResponse({ type: Account })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findByUser(user.sub);
  }
}
