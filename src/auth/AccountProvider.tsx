import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts } from '../api/requests'
import { queryKeys } from '../api/queries'
import { useAuth } from './context'
import {
  ACCOUNT_REVOKED_EVENT,
  getActiveAccountId,
  setActiveAccountId,
} from './account'
import {
  AccountContext,
  REVOKED_MESSAGE,
  type AccountContextValue,
} from './account-context'

// Dados que não dependem da conta ativa e podem ficar no cache na troca
const ACCOUNT_INDEPENDENT = new Set(['me', 'accounts', 'invites'])

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState(getActiveAccountId)
  const [revokedNotice, setRevokedNotice] = useState<string | null>(null)

  const accounts = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: listAccounts,
    enabled: Boolean(user),
  })

  // Tira da memória tudo que era da conta anterior (saldo, extrato, resumo...)
  const forgetAccountData = useCallback(
    () =>
      queryClient.removeQueries({
        predicate: (query) =>
          !ACCOUNT_INDEPENDENT.has(String(query.queryKey[0])),
      }),
    [queryClient],
  )

  const switchTo = useCallback(
    (id: string) => {
      const personal = accounts.data?.[0]
      // A pessoal é o padrão da API: não precisa de cabeçalho
      const next = id === personal?.id ? null : id
      setActiveAccountId(next)
      setActiveId(next)
      setRevokedNotice(null)
      forgetAccountData()
    },
    [accounts.data, forgetAccountData],
  )

  // A API respondeu "sem acesso" para a empresa escolhida
  useEffect(() => {
    const onRevoked = () => {
      setActiveId(null)
      setRevokedNotice(REVOKED_MESSAGE)
      forgetAccountData()
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    }
    window.addEventListener(ACCOUNT_REVOKED_EVENT, onRevoked)
    return () => window.removeEventListener(ACCOUNT_REVOKED_EVENT, onRevoked)
  }, [forgetAccountData, queryClient])

  // Saiu da sessão (logout/expirou): a próxima começa na pessoal
  const currentId = user ? activeId : null

  const value = useMemo<AccountContextValue>(() => {
    const list = accounts.data ?? []
    return {
      accounts: list,
      active: list.find((a) => a.id === currentId) ?? list[0] ?? null,
      loading: Boolean(user) && accounts.isPending,
      switchTo,
      revokedNotice,
    }
  }, [accounts.data, accounts.isPending, currentId, user, switchTo, revokedNotice])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
