import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  /**
   * Senha atual, para confirmar que é o próprio usuário
   * @example "senhaForte123"
   */
  @IsString()
  current_password: string;

  /**
   * Nova senha (mínimo 8 caracteres)
   * @example "novaSenha456"
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  new_password: string;
}
