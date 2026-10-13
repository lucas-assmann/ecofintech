import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  /** @example "maria@email.com" */
  @IsEmail()
  email: string;

  /** @example "senhaForte123" */
  @IsString()
  password: string;
}
