import { ApiProperty } from '@nestjs/swagger';
import {
  user_role,
  user_status,
} from '../../../database/generated/prisma/enums.js';

/** Usuário como devolvido pela API (sem a senha). */
export class User {
  /** @example "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c" */
  id: string;

  /** @example "Maria Silva" */
  name: string;

  /** @example "maria@email.com" */
  email: string;

  /** @example "1995-08-20" */
  date_of_birth: string;

  /** @example "52998224725" */
  cpf: string;

  /** @example "11987654321" */
  phone: string;

  @ApiProperty({
    enum: user_status,
    enumName: 'user_status',
    description: 'Situação da conta',
    example: user_status.active,
  })
  status: user_status;

  @ApiProperty({
    enum: user_role,
    enumName: 'user_role',
    description: 'Perfil de acesso',
    example: user_role.user,
  })
  role: user_role;

  created_at: Date;

  updated_at: Date;
}
