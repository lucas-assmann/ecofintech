import { Throttle, minutes } from '@nestjs/throttler';

/**
 * Limite mais rígido para rotas públicas sensíveis (login, cadastro, senha):
 * 5 tentativas por minuto por IP. Dificulta adivinhar senhas na força bruta
 * e disparar e-mails em massa. Passou do limite, a API responde 429.
 */
export const AuthThrottle = () =>
  Throttle({ default: { limit: 5, ttl: minutes(1) } });
