import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDeactivationRequestDto {
  /**
   * Observação do suporte sobre a decisão (opcional)
   * @example "Conta encerrada a pedido do cliente"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
