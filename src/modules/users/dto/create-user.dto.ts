import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
   * Senha (mínimo 8 caracteres). Nunca é devolvida pela API.
   * @example "senhaForte123"
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
