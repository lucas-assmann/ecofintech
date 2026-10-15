import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { OnlyDigits } from '../../../common/validators/cpf.js';
import { IsCnpj } from '../../../common/validators/cnpj.js';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateCompanyDto {
  /**
   * CNPJ, com ou sem pontuação
   * @example "11.222.333/0001-81"
   */
  @OnlyDigits()
  @IsCnpj()
  cnpj: string;

  /**
   * Razão social (nome oficial)
   * @example "Pão Bom Comércio de Alimentos LTDA"
   */
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legal_name: string;

  /**
   * Nome fantasia (aparece para quem recebe transferências)
   * @example "Padaria Pão Bom"
   */
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  trade_name: string;
}
