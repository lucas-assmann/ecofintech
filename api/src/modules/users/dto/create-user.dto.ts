import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsCpf, OnlyDigits } from '../../../common/validators/cpf.js';

export class CreateUserDto {
  /**
   * Nome completo
   * @example "Maria Silva"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /**
   * E-mail único do usuário
   * @example "maria@email.com"
   */
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * Data de nascimento no formato YYYY-MM-DD
   * @example "1995-08-20"
   */
  @IsDateString({ strict: true })
  date_of_birth: string;

  /**
   * CPF, com ou sem pontuação (salvo só com dígitos). Não pode ser alterado depois.
   * @example "529.982.247-25"
   */
  @OnlyDigits()
  @IsCpf()
  cpf: string;

  /**
   * Telefone com DDD, com ou sem pontuação (salvo só com dígitos)
   * @example "(11) 98765-4321"
   */
  @OnlyDigits()
  @Matches(/^\d{10,11}$/, {
    message: 'phone deve ter DDD + número (10 ou 11 dígitos)',
  })
  phone: string;

  /**
   * Senha (mínimo 8 caracteres). Nunca é devolvida pela API.
   * @example "senhaForte123"
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
