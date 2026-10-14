import { ApiProperty } from '@nestjs/swagger';
import { company_role } from '../../../database/generated/prisma/enums.js';

export class CompanyMember {
  user_id: string;

  /** @example "Maria Silva" */
  name: string;

  /** @example "maria@email.com" */
  email: string;

  @ApiProperty({ enum: company_role, enumName: 'company_role' })
  role: company_role;

  /** Quando entrou na empresa */
  created_at: Date;
}

export class InvitedUser {
  /** @example "João Souza" */
  name: string;

  /** @example "joao@email.com" */
  email: string;
}

export class CompanyInvite {
  id: string;

  invited_user: InvitedUser;

  created_at: Date;
}

/** Membros da empresa e, só para o dono, os convites pendentes. */
export class CompanyMembers {
  /** Dono primeiro, depois por ordem de entrada */
  members: CompanyMember[];

  /** Convites pendentes (vazio para quem não é dono) */
  invites: CompanyInvite[];
}
