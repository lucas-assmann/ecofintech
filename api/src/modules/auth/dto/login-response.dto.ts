export class LoginResponseDto {
  /** Token a enviar no header `Authorization: Bearer <token>` */
  access_token: string;

  /** @example "Bearer" */
  token_type: string;

  /**
   * Validade do token em segundos
   * @example 3600
   */
  expires_in: number;
}
