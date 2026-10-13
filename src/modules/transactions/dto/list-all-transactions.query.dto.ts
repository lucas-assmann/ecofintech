import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  transaction_category,
  transaction_type,
} from '../../../database/generated/prisma/enums.js';
import { ListTransactionsQueryDto } from './list-transactions.query.dto.js';

/** Filtros da listagem geral de lançamentos (admin). Todos são opcionais. */
export class ListAllTransactionsQueryDto extends ListTransactionsQueryDto {
  /**
   * Busca pelo dono da conta: parte do nome, do e-mail ou do CPF
   * @example "fulano"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: transaction_category,
    enumName: 'transaction_category',
  })
  @IsOptional()
  @IsEnum(transaction_category)
  category?: transaction_category;

  @ApiPropertyOptional({
    enum: transaction_type,
    enumName: 'transaction_type',
  })
  @IsOptional()
  @IsEnum(transaction_type)
  type?: transaction_type;

  /**
   * Data inicial (inclusive), no formato AAAA-MM-DD
   * @example "2026-10-01"
   */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  /**
   * Data final (inclusive), no formato AAAA-MM-DD
   * @example "2026-10-31"
   */
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
