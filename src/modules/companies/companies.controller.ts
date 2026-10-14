import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { OperableAccount } from '../accounts/entities/operable-account.entity.js';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';

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
}
