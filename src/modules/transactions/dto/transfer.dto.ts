import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TransferDto {
  /**
   * E-mail de quem vai receber (funciona como uma chave Pix)
   * @example "fulano@email.com"
   */
  @IsEmail()
  to_email: string;

  /**
   * Valor em reais, com no máximo 2 casas decimais
   * @example 200
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000) // limite por operação
  amount: number;

  /**
   * Descrição opcional que aparece no extrato
   * @example "Aluguel"
   */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  description?: string;
}
