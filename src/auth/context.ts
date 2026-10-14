import { createContext, useContext } from 'react'
import type { User } from '../api/client'

export interface AuthContextValue {
  user: User | null
  /** true enquanto ainda verifica se o token salvo é válido */
  loading: boolean
  isAdmin: boolean
  /**
   * Faz login. beforeEnter roda com o token já salvo (as requisições já
   * funcionam), mas antes de o app considerar a pessoa logada: é o momento de
   * decidir para onde ir, sem as telas de visitante redirecionarem antes.
   */
  login: (
    email: string,
    password: string,
    beforeEnter?: () => Promise<void>,
  ) => Promise<void>
  /**
   * Encerra a sessão e volta para o login, opcionalmente com uma mensagem.
   * skipApi: quando o token já não vale (ex.: logo após trocar a senha).
   */
  logout: (message?: string, options?: { skipApi?: boolean }) => Promise<void>
  /**
   * Aviso para a tela de login (ex.: "Sua sessão expirou"). Fica no contexto,
   * e não no estado da navegação, para sobreviver aos redirecionamentos que
   * acontecem quando a sessão acaba.
   */
  notice: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou. Faça login novamente.'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro do AuthProvider')
  return context
}
