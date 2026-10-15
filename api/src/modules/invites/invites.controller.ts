import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { InvitesService } from './invites.service.js';
import { PendingInvite } from './entities/pending-invite.entity.js';

// Convites do ponto de vista de quem foi convidado.
// (O dono cria e cancela convites em /companies/:id/invites.)
@ApiTags('Invites')
@ApiBearerAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  @ApiOperation({ summary: 'Convites pendentes do usuário logado' })
  @ApiOkResponse({ type: [PendingInvite] })
  listPending(@CurrentUser() user: JwtPayload) {
    return this.invitesService.listPending(user.sub);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aceita o convite e entra na empresa como membro' })
  @ApiNoContentResponse({ description: 'Agora faz parte da empresa' })
  @ApiNotFoundResponse({
    description: 'Convite não encontrado, de outra pessoa ou já respondido',
  })
  accept(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitesService.accept(user.sub, id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Recusa o convite' })
  @ApiNoContentResponse({ description: 'Convite recusado' })
  @ApiNotFoundResponse({
    description: 'Convite não encontrado, de outra pessoa ou já respondido',
  })
  decline(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitesService.decline(user.sub, id);
  }
}
