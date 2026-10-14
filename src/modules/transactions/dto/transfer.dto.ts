import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCpf, OnlyDigits } from '../../../common/validators/cpf.js';
import { IsCnpj } from '../../../common/validators/cnpj.js';

// Quem recebe é identificado por to_email, to_cpf OU to_cnpj (exatamente um)
export class TransferDto {
  /**
   * E-mail de quem vai receber. Informe só um entre `to_email`, `to_cpf` e `to_cnpj`.
   * @example "fulano@email.com"
   */
  @IsOptional()
  @IsEmail()
  to_email?: string;

  /**
   * CPF de quem vai receber, com ou sem pontuação.
   * @example "529.982.247-25"
   */
  @IsOptional()
  @OnlyDigits()
  @IsCpf()
  to_cpf?: string;

  /**
   * CNPJ da empresa que vai receber, com ou sem pontuação.
   * @example "11.222.333/0001-81"
   */
  @IsOptional()
  @OnlyDigits()
  @IsCnpj()
  to_cnpj?: string;

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
