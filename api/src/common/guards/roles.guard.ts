import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import type { user_role } from '../../database/generated/prisma/enums.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from './auth.guard.js';

/**
 * Guard global que roda depois do AuthGuard. Só age em rotas com @Roles(...).
 * O perfil é lido do banco (não do token): se alguém perde o admin,
 * perde na hora, sem esperar o token expirar.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<user_role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const dbUser = await this.prisma.users.findUnique({
      where: { id: user.sub },
      select: { role: true },
    });

    if (!dbUser || !roles.includes(dbUser.role)) {
      throw new ForbiddenException('Acesso restrito');
    }
    return true;
  }
}
