import { useSyncExternalStore } from 'react'

// Conta com que a pessoa está operando (pessoal ou de empresa). Fica no
// sessionStorage, como o token: vale só para esta aba.
const ACCOUNT_KEY = 'ecofintech.account'

/** Mesma mensagem da API quando a pessoa não pode mais usar a conta */
export const NO_ACCESS_MESSAGE = 'Sem acesso a esta conta'

export const ACCOUNT_REVOKED_EVENT = 'ecofintech:account-revoked'

/** Disparado sempre que a conta guardada muda (troca, logout, revogação) */
export const ACCOUNT_CHANGED_EVENT = 'ecofintech:account-changed'

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
  // O que vai no cabeçalho e o que aparece na tela vêm deste mesmo valor:
  // quem mostra a conta ativa escuta o evento para se atualizar
  window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT))
}

/**
 * Conta ativa como estado do React: o componente renderiza de novo quando ela
 * muda. Lê do mesmo lugar que o cabeçalho X-Account-Id, então nunca discordam.
 */
export function useActiveAccountId(): string | null {
  return useSyncExternalStore(subscribe, getActiveAccountId)
}

function subscribe(onChange: () => void) {
  window.addEventListener(ACCOUNT_CHANGED_EVENT, onChange)
  return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChange)
}

/**
 * A API disse que a pessoa não tem mais acesso à conta escolhida (ex.: foi
 * removida da empresa): volta para a pessoal e avisa o app.
 */
export function revokeActiveAccount(): void {
  setActiveAccountId(null)
  window.dispatchEvent(new Event(ACCOUNT_REVOKED_EVENT))
}
