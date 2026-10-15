import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Dados guardados dentro do token. `sub` (subject) é o id do usuário e
 * `ver` é a versão dos tokens dele no momento do login.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  ver: number;
}

export type AuthenticatedRequest = Request & { user: JwtPayload };

// Mensagem única para qualquer token que não vale mais: o front, ao receber
// 401, deve voltar para a tela de login
export const SESSION_EXPIRED = 'Sessão expirada. Faça login novamente.';

/**
 * Guard global: toda rota exige `Authorization: Bearer <token>`,
 * exceto as marcadas com @Public().
 *
 * Além da assinatura e da validade, confere no banco se a versão do token
 * ainda é a atual (troca de senha e logout incrementam a versão) e se a conta
 * continua ativa.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token não informado');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: { token_version: true, status: true },
    });
    if (
      !user ||
      user.status !== 'active' ||
      user.token_version !== payload.ver
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    request.user = payload;
    return true;
  }
}
