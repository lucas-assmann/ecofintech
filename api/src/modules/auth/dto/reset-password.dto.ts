import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /**
   * Token recebido no link do e-mail
   * @example "q3Jt0sX8m2..."
   */
  @IsString()
  @MaxLength(100)
  token: string;

  /**
   * Nova senha (mínimo 8 caracteres)
   * @example "novaSenha456"
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  new_password: string;
}
