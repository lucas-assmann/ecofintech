import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { DeactivationRequestsService } from './deactivation-requests.service.js';
import { CreateDeactivationRequestDto } from './dto/create-deactivation-request.dto.js';
import { ReviewDeactivationRequestDto } from './dto/review-deactivation-request.dto.js';
import { ListDeactivationRequestsQueryDto } from './dto/list-deactivation-requests.query.dto.js';
import {
  DeactivationRequest,
  DeactivationRequestCreatedResponse,
} from './entities/deactivation-request.entity.js';

@ApiTags('Deactivation requests')
@ApiBearerAuth()
@Controller('deactivation-requests')
export class DeactivationRequestsController {
  constructor(
    private readonly deactivationRequestsService: DeactivationRequestsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicita a desativação da própria conta (o suporte avaliará)',
  })
  @ApiAcceptedResponse({ type: DeactivationRequestCreatedResponse })
  @ApiConflictResponse({ description: 'Já existe uma solicitação em análise' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDeactivationRequestDto,
  ) {
    return this.deactivationRequestsService.create(user.sub, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Situação da última solicitação do usuário logado' })
  @ApiOkResponse({ type: DeactivationRequest })
  @ApiNotFoundResponse({ description: 'Nenhuma solicitação' })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.deactivationRequestsService.findMine(user.sub);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Lista as solicitações (somente admin)' })
  @ApiOkResponse({ type: [DeactivationRequest] })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  findAll(@Query() query: ListDeactivationRequestsQueryDto) {
    return this.deactivationRequestsService.findAll(query);
  }

  @Patch(':id/approve')
  @Roles('admin')
  @ApiOperation({
    summary: 'Aprova e desativa a conta (somente admin; exige saldo zerado)',
  })
  @ApiOkResponse({ type: DeactivationRequest })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiConflictResponse({
    description: 'Solicitação já avaliada ou conta ainda com saldo',
  })
  approve(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDeactivationRequestDto,
  ) {
    return this.deactivationRequestsService.approve(admin.sub, id, dto);
  }

  @Patch(':id/reject')
  @Roles('admin')
  @ApiOperation({ summary: 'Recusa a solicitação (somente admin)' })
  @ApiOkResponse({ type: DeactivationRequest })
  @ApiForbiddenResponse({ description: 'Usuário não é admin' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada' })
  @ApiConflictResponse({ description: 'Solicitação já avaliada' })
  reject(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDeactivationRequestDto,
  ) {
    return this.deactivationRequestsService.reject(admin.sub, id, dto);
  }
}
