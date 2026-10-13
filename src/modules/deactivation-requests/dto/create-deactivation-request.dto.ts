import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeactivationRequestDto {
  /**
   * Motivo da solicitação (opcional)
   * @example "Não vou mais usar a conta"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
