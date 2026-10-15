import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { RolesGuard } from './roles.guard.js';

function setup(requiredRoles: string[] | undefined, dbRole: string | null) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  const prisma = {
    users: {
      findUnique: vi.fn().mockResolvedValue(dbRole ? { role: dbRole } : null),
    },
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'user-1', email: 'a@b.com' } }),
    }),
  } as unknown as ExecutionContext;
  const guard = new RolesGuard(reflector, prisma as unknown as PrismaService);
  return { guard, context, prisma };
}

describe('RolesGuard', () => {
  it('libera rotas sem @Roles sem consultar o banco', async () => {
    const { guard, context, prisma } = setup(undefined, 'user');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  it('libera quando o perfil do banco está entre os exigidos', async () => {
    const { guard, context } = setup(['admin'], 'admin');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('recusa usuário comum em rota de admin', async () => {
    const { guard, context } = setup(['admin'], 'user');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('recusa quando o usuário do token não existe mais', async () => {
    const { guard, context } = setup(['admin'], null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
