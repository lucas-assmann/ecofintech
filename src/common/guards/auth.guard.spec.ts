import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard.js';

const jwt = new JwtService({ secret: 'segredo-de-teste' });

function contextWith(authorization?: string, isPublic = false) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };
  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new AuthGuard(jwt, reflector), context, request };
}

describe('AuthGuard', () => {
  it('libera rotas @Public() sem token', async () => {
    const { guard, context } = contextWith(undefined, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('recusa quando não há token', async () => {
    const { guard, context } = contextWith(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('recusa token inválido', async () => {
    const { guard, context } = contextWith('Bearer token-falso');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('aceita token válido e coloca o usuário na requisição', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', email: 'a@b.com' });
    const { guard, context, request } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 'user-1' });
  });
});
