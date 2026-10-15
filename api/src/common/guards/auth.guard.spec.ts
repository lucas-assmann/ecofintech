import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthGuard, SESSION_EXPIRED } from './auth.guard.js';

const jwt = new JwtService({ secret: 'segredo-de-teste' });

function setup(
  authorization?: string,
  options: { isPublic?: boolean; dbUser?: object | null } = {},
) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };
  const reflector = {
    getAllAndOverride: () => options.isPublic ?? false,
  } as unknown as Reflector;
  const prisma = {
    users: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.dbUser === undefined
            ? { token_version: 0, status: 'active' }
            : options.dbUser,
        ),
    },
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(
    jwt,
    reflector,
    prisma as unknown as PrismaService,
  );
  return { guard, context, request };
}

const validToken = (ver = 0) =>
  jwt.signAsync({ sub: 'user-1', email: 'a@b.com', ver });

describe('AuthGuard', () => {
  it('libera rotas @Public() sem token', async () => {
    const { guard, context } = setup(undefined, { isPublic: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('recusa quando não há token', async () => {
    const { guard, context } = setup(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('recusa token inválido', async () => {
    const { guard, context } = setup('Bearer token-falso');
    await expect(guard.canActivate(context)).rejects.toThrow(SESSION_EXPIRED);
  });

  it('aceita token válido e coloca o usuário na requisição', async () => {
    const { guard, context, request } = setup(`Bearer ${await validToken()}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 'user-1', ver: 0 });
  });

  it('recusa token de versão antiga (após troca de senha ou logout)', async () => {
    const { guard, context } = setup(`Bearer ${await validToken(0)}`, {
      dbUser: { token_version: 1, status: 'active' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(SESSION_EXPIRED);
  });

  it('recusa usuário desativado', async () => {
    const { guard, context } = setup(`Bearer ${await validToken()}`, {
      dbUser: { token_version: 0, status: 'deactivated' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(SESSION_EXPIRED);
  });

  it('recusa usuário que não existe mais', async () => {
    const { guard, context } = setup(`Bearer ${await validToken()}`, {
      dbUser: null,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(SESSION_EXPIRED);
  });
});
