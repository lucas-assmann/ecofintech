import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReverseTransactionDto {
  /**
   * Motivo do estorno (aparece como descrição no extrato)
   * @example "Depósito feito na conta errada"
   */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  reason?: string;
}
