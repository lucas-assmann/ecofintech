export class InviteCompany {
  id: string;

  /** @example "Padaria Pão Bom" */
  trade_name: string;

  /** @example "11222333000181" */
  cnpj: string;
}

export class InviteSender {
  /** @example "Maria Silva" */
  name: string;
}

/** Convite para participar de uma empresa, ainda sem resposta. */
export class PendingInvite {
  id: string;

  company: InviteCompany;

  /** Quem convidou (o dono da empresa) */
  invited_by: InviteSender;

  created_at: Date;
}
