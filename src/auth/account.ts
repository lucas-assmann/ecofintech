// Conta com que a pessoa está operando (pessoal ou de empresa). Fica no
// sessionStorage, como o token: vale só para esta aba.
const ACCOUNT_KEY = 'ecofintech.account'

/** Mesma mensagem da API quando a pessoa não pode mais usar a conta */
export const NO_ACCESS_MESSAGE = 'Sem acesso a esta conta'

export const ACCOUNT_REVOKED_EVENT = 'ecofintech:account-revoked'

/** Id da conta escolhida, ou null para a conta pessoal. */
export function getActiveAccountId(): string | null {
  try {
    return sessionStorage.getItem(ACCOUNT_KEY)
  } catch {
    return null
  }
}

export function setActiveAccountId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(ACCOUNT_KEY, id)
    else sessionStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Armazenamento indisponível: volta para a pessoal ao recarregar
  }
}

/**
 * A API disse que a pessoa não tem mais acesso à conta escolhida (ex.: foi
 * removida da empresa): volta para a pessoal e avisa o app.
 */
export function revokeActiveAccount(): void {
  setActiveAccountId(null)
  window.dispatchEvent(new Event(ACCOUNT_REVOKED_EVENT))
}
