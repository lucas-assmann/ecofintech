import { SetMetadata } from '@nestjs/common';
import type { user_role } from '../../database/generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe a rota (ou o controller) aos perfis informados.
 *
 * @example
 * @Roles('admin')
 */
export const Roles = (...roles: user_role[]) => SetMetadata(ROLES_KEY, roles);
