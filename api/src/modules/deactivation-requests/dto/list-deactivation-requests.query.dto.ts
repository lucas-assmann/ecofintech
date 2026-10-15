import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { deactivation_request_status } from '../../../database/generated/prisma/enums.js';

export class ListDeactivationRequestsQueryDto {
  @ApiPropertyOptional({
    enum: deactivation_request_status,
    enumName: 'deactivation_request_status',
    description: 'Filtra pela situação (sem filtro, traz todas)',
  })
  @IsOptional()
  @IsEnum(deactivation_request_status)
  status?: deactivation_request_status;
}
