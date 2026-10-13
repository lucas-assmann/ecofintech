// Os decorators de validação dependem dele; importado aqui para o arquivo
// funcionar também fora do Nest (ex.: nos testes)
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Variáveis de ambiente que a API precisa para subir. */
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @Matches(/^postgres(ql)?:\/\/.+/, {
    message:
      'DATABASE_URL deve ser uma URL postgresql://usuario:senha@host:porta/banco',
  })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET deve ter pelo menos 32 caracteres (use um valor aleatório)',
  })
  JWT_SECRET: string;

  @IsInt({ message: 'JWT_EXPIRES_IN deve ser um número inteiro de segundos' })
  @Min(60, { message: 'JWT_EXPIRES_IN deve ser de pelo menos 60 segundos' })
  JWT_EXPIRES_IN: number;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Endereço do front, usado nos links enviados por e-mail */
  @IsOptional()
  @Matches(/^https?:\/\/[^/]+$/, {
    message:
      'APP_URL deve ser uma URL sem barra no final, ex.: http://localhost:5173',
  })
  APP_URL?: string;

  // E-mail (SMTP). Sem SMTP_HOST, a API não envia: escreve o conteúdo no terminal.
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  /** Remetente, ex.: Ecofintech <nao-responda@ecofintech.com> */
  @IsOptional()
  @IsString()
  MAIL_FROM?: string;
}

/**
 * Valida o .env na inicialização. Se algo estiver faltando ou errado, a API
 * não sobe e mostra exatamente o que corrigir (em vez de quebrar depois, no
 * meio de uma requisição).
 */
export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, {
    // Converte texto do .env para número onde o tipo pede (ex.: PORT, JWT_EXPIRES_IN)
    enableImplicitConversion: true,
  });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const problems = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Configuração inválida no .env:\n${problems}`);
  }
  return env;
}
