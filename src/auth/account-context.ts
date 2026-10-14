import { createContext, useContext } from 'react'
import type { OperableAccount } from '../api/client'

export interface AccountContextValue {
  /** Contas que a pessoa pode usar (a pessoal primeiro) */
  accounts: OperableAccount[]
  /** Conta com que está operando agora (null enquanto carrega) */
  active: OperableAccount | null
  loading: boolean
  /** Troca a conta ativa; os dados da conta anterior saem da tela */
  switchTo: (id: string) => void
  /** Aviso quando a pessoa perdeu o acesso à empresa que estava usando */
  revokedNotice: string | null
}

export const AccountContext = createContext<AccountContextValue | null>(null)

export const REVOKED_MESSAGE =
  'Você não tem mais acesso a essa empresa. Voltamos para a sua conta pessoal.'

export function useActiveAccount(): AccountContextValue {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useActiveAccount precisa estar dentro do AccountProvider')
  }
  return context
}
