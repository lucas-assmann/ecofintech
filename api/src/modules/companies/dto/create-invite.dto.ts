import { IsEmail, IsOptional } from 'class-validator';
import { IsCpf, OnlyDigits } from '../../../common/validators/cpf.js';

// Quem é convidado é identificado por email OU cpf (exatamente um dos dois)
export class CreateInviteDto {
  /**
   * E-mail de quem já tem conta no Ecofintech. Informe este ou `cpf`.
   * @example "joao@email.com"
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * CPF de quem já tem conta, com ou sem pontuação. Informe este ou `email`.
   * @example "529.982.247-25"
   */
  @IsOptional()
  @OnlyDigits()
  @IsCpf()
  cpf?: string;
}
