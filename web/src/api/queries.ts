import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useActiveAccountId } from '../auth/account'
import * as requests from './requests'

// Conta ativa na chave (null = pessoal): saldo, extrato e resumo de cada conta
// ficam em chaves diferentes, e trocar de conta faz as telas abertas buscarem
// os dados da nova. Ela vai no FIM da chave, então invalidar pelo começo
// (ex.: ['transactions']) continua pegando todas as contas.
type AccountId = string | null

// Chaves de cache: invalidar uma delas faz a tela buscar de novo
export const queryKeys = {
  account: ['account'] as const,
  accountOf: (accountId: AccountId) => ['account', accountId] as const,
  // Não dependem da conta ativa: sobrevivem à troca de conta
  accounts: ['accounts'] as const,
  invites: ['invites'] as const,
  members: (companyId: string) => ['members', companyId] as const,
  transactions: ['transactions'] as const,
  transactionsPage: (limit: number, offset: number, accountId: AccountId) =>
    ['transactions', limit, offset, accountId] as const,
  // Começa com 'transactions': invalidar o extrato (após uma transferência)
  // também atualiza o resumo do dashboard
  summary: (days: number, accountId: AccountId) =>
    ['transactions', 'summary', days, accountId] as const,
  myDeactivation: ['deactivation', 'me'] as const,
  users: ['admin', 'users'] as const,
  deactivations: (status?: string) =>
    ['admin', 'deactivations', status ?? 'all'] as const,
  adminTransactions: ['admin', 'transactions'] as const,
  adminTransactionsPage: (
    filters: requests.AdminTransactionFilters,
    limit: number,
    offset: number,
  ) => ['admin', 'transactions', filters, limit, offset] as const,
}

export const useAccount = () =>
  useQuery({
    queryKey: queryKeys.accountOf(useActiveAccountId()),
    queryFn: requests.getMyAccount,
  })

export const useTransactions = (limit: number, offset = 0) => {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: queryKeys.transactionsPage(limit, offset, accountId),
    queryFn: () => requests.listTransactions({ limit, offset }),
    // Mantém a página anterior na tela enquanto carrega a próxima, mas só
    // da mesma conta: nunca mostra o extrato de uma conta como se fosse de outra
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === accountId ? previous : undefined,
  })
}

export const useSummary = (days: requests.SummaryDays) => {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: queryKeys.summary(days, accountId),
    queryFn: () => requests.getSummary(days),
    // Ao trocar o período, o gráfico anterior fica na tela até o novo chegar
    // (de novo, só se for da mesma conta)
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === accountId ? previous : undefined,
  })
}

/** Contas com saldo atualizado: recarrega ao abrir a tela que usa */
export const useAccounts = () =>
  useQuery({ queryKey: queryKeys.accounts, queryFn: requests.listAccounts })

export const useInvites = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.invites,
    queryFn: requests.listInvites,
    enabled,
  })

export const useMembers = (companyId: string | null) =>
  useQuery({
    queryKey: queryKeys.members(companyId ?? ''),
    queryFn: () => requests.listMembers(companyId!),
    enabled: Boolean(companyId),
  })

export const useAdminTransactions = (
  filters: requests.AdminTransactionFilters,
  limit: number,
  offset = 0,
) =>
  useQuery({
    queryKey: queryKeys.adminTransactionsPage(filters, limit, offset),
    queryFn: () => requests.listAllTransactions({ ...filters, limit, offset }),
    placeholderData: keepPreviousData,
  })

export const useMyDeactivation = () =>
  useQuery({
    queryKey: queryKeys.myDeactivation,
    queryFn: requests.getMyDeactivation,
  })
