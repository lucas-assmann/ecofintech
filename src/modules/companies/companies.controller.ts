import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { OperableAccount } from '../accounts/entities/operable-account.entity.js';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { CompanyMembers } from './entities/company-members.entity.js';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Abre uma empresa: o usuário vira o dono e a conta da empresa é criada na hora',
  })
  @ApiCreatedResponse({ type: OperableAccount })
  @ApiBadRequestResponse({ description: 'CNPJ ou nomes inválidos' })
  @ApiConflictResponse({ description: 'CNPJ já cadastrado' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(user.sub, dto);
  }

  @Get(':id/members')
  @ApiOperation({
    summary:
      'Membros da empresa (qualquer membro); convites pendentes só para o dono',
  })
  @ApiOkResponse({ type: CompanyMembers })
  @ApiForbiddenResponse({ description: 'Não faz parte da empresa' })
  listMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.companiesService.listMembers(user.sub, id);
  }

  @Post(':id/invites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Convida alguém já cadastrado, por e-mail ou CPF (somente o dono)',
  })
  @ApiCreatedResponse({ description: 'Convite criado' })
  @ApiBadRequestResponse({ description: 'Informe email ou cpf (só um)' })
  @ApiForbiddenResponse({ description: 'Não é o dono da empresa' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiConflictResponse({
    description: 'Já faz parte da empresa ou já tem convite pendente',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Convidar a si mesmo ou usuário desativado',
  })
  invite(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.companiesService.invite(user.sub, id, dto);
  }

  @Delete(':id/invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancela um convite pendente (somente o dono)' })
  @ApiNoContentResponse({ description: 'Convite cancelado' })
  @ApiForbiddenResponse({ description: 'Não é o dono da empresa' })
  @ApiNotFoundResponse({
    description: 'Convite não encontrado ou já respondido',
  })
  cancelInvite(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.companiesService.cancelInvite(user.sub, id, inviteId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Remove um membro (somente o dono). O acesso dele cai na próxima requisição',
  })
  @ApiNoContentResponse({ description: 'Membro removido' })
  @ApiForbiddenResponse({ description: 'Não é o dono da empresa' })
  @ApiNotFoundResponse({ description: 'Membro não encontrado' })
  @ApiUnprocessableEntityResponse({ description: 'O dono não pode se remover' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.companiesService.removeMember(user.sub, id, userId);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sai da empresa (o dono não pode sair)' })
  @ApiNoContentResponse({ description: 'Saiu da empresa' })
  @ApiForbiddenResponse({ description: 'Não faz parte da empresa' })
  @ApiUnprocessableEntityResponse({ description: 'O dono não pode sair' })
  leave(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.companiesService.leave(user.sub, id);
  }
}
