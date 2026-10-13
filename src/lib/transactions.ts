import type { Transaction } from '../api/client'

/** Título do lançamento para o extrato, do ponto de vista do dono da conta. */
export function describeTransaction(t: Transaction): string {
  const who = t.counterparty?.name
  switch (t.category) {
    case 'deposito':
      return 'Depósito'
    case 'transferencia':
      return t.type === 'entrada'
        ? `Transferência recebida${who ? ` de ${who}` : ''}`
        : `Transferência enviada${who ? ` para ${who}` : ''}`
    case 'estorno':
      return t.type === 'entrada' ? 'Estorno recebido' : 'Estorno debitado'
  }
}

export const isIncoming = (t: Transaction) => t.type === 'entrada'
