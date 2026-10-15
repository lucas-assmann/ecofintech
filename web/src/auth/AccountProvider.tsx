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
  ACCOUNT_CHANGED_EVENT,
  ACCOUNT_REVOKED_EVENT,
  getActiveAccountId,
  revokeActiveAccount,
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
  // A conta ativa mora no sessionStorage (é ela que vai no cabeçalho
  // X-Account-Id). Toda escrita passa por setActiveAccountId, que dispara um
  // evento: este estado só espelha o valor guardado, então tela e cabeçalho
  // nunca discordam (nem depois de sair e entrar de novo).
  const [storedId, setStoredId] = useState(getActiveAccountId)
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
      setActiveAccountId(id === personal?.id ? null : id)
      forgetAccountData()
    },
    [accounts.data, forgetAccountData],
  )

  useEffect(() => {
    // Qualquer mudança (troca, logout, login) apaga o aviso antigo
    const onChanged = () => {
      setRevokedNotice(null)
      setStoredId(getActiveAccountId())
    }
    // A API respondeu "sem acesso" para a empresa escolhida
    const onRevoked = () => {
      setRevokedNotice(REVOKED_MESSAGE)
      forgetAccountData()
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    }
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onChanged)
    window.addEventListener(ACCOUNT_REVOKED_EVENT, onRevoked)
    return () => {
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChanged)
      window.removeEventListener(ACCOUNT_REVOKED_EVENT, onRevoked)
    }
  }, [forgetAccountData, queryClient])

  // A empresa escolhida sumiu da lista (ex.: foi removido): volta para a pessoal
  useEffect(() => {
    const id = getActiveAccountId()
    if (user && accounts.data && id && !accounts.data.some((a) => a.id === id)) {
      revokeActiveAccount()
    }
  }, [user, accounts.data])

  const value = useMemo<AccountContextValue>(() => {
    const list = accounts.data ?? []
    const currentId = user ? storedId : null
    return {
      accounts: list,
      active: list.find((a) => a.id === currentId) ?? list[0] ?? null,
      loading: Boolean(user) && accounts.isPending,
      switchTo,
      revokedNotice,
    }
  }, [accounts.data, accounts.isPending, user, storedId, switchTo, revokedNotice])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
