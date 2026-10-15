// Guarda o token da sessão. Usa sessionStorage: vale só para esta aba e é
// apagado ao fechá-la (menos exposição que localStorage num app financeiro).
const TOKEN_KEY = 'ecofintech.token'

export const SESSION_EXPIRED_EVENT = 'ecofintech:session-expired'

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Armazenamento indisponível (ex.: modo restrito): a sessão dura até recarregar
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // nada a fazer
  }
}

/**
 * Avisa o app que a sessão acabou (a API respondeu 401: token expirado, senha
 * trocada, logout em outro lugar ou conta desativada). O AuthProvider escuta
 * este evento e volta para a tela de login.
 */
export function expireSession(): void {
  clearToken()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
