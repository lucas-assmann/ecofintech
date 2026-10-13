import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  /** @example "maria@email.com" */
  @IsEmail()
  email: string;
}
