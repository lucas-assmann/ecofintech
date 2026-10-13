import { ApiProperty } from '@nestjs/swagger';
import { company_role } from '../../../database/generated/prisma/enums.js';

/** Conta que o usuário pode usar: a pessoal ou a de uma empresa da qual participa. */
export class OperableAccount {
  /** Id da conta (é o valor do cabeçalho X-Account-Id) */
  id: string;

  @ApiProperty({ enum: ['personal', 'company'] })
  kind: 'personal' | 'company';

  /**
   * Nome da pessoa ou nome fantasia da empresa
   * @example "Padaria Pão Bom"
   */
  name: string;

  /**
   * CPF (11 dígitos) ou CNPJ (14 dígitos), só números
   * @example "11222333000181"
   */
  document: string;

  /** @example "1200.00" */
  balance: string;

  @ApiProperty({
    enum: company_role,
    enumName: 'company_role',
    nullable: true,
    description: 'Papel na empresa (null na conta pessoal)',
  })
  role: company_role | null;

  /** Id da empresa (null na conta pessoal) */
  company_id: string | null;
}
