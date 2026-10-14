import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as requests from './requests'

// Chaves de cache: invalidar uma delas faz a tela buscar de novo
export const queryKeys = {
  account: ['account'] as const,
  // Não dependem da conta ativa: sobrevivem à troca de conta
  accounts: ['accounts'] as const,
  invites: ['invites'] as const,
  members: (companyId: string) => ['members', companyId] as const,
  transactions: ['transactions'] as const,
  transactionsPage: (limit: number, offset: number) =>
    ['transactions', limit, offset] as const,
  // Começa com 'transactions': invalidar o extrato (após uma transferência)
  // também atualiza o resumo do dashboard
  summary: (days: number) => ['transactions', 'summary', days] as const,
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
  useQuery({ queryKey: queryKeys.account, queryFn: requests.getMyAccount })

export const useTransactions = (limit: number, offset = 0) =>
  useQuery({
    queryKey: queryKeys.transactionsPage(limit, offset),
    queryFn: () => requests.listTransactions({ limit, offset }),
    // Mantém a página anterior na tela enquanto carrega a próxima
    placeholderData: keepPreviousData,
  })

export const useSummary = (days: requests.SummaryDays) =>
  useQuery({
    queryKey: queryKeys.summary(days),
    queryFn: () => requests.getSummary(days),
    // Ao trocar o período, o gráfico anterior fica na tela até o novo chegar
    placeholderData: keepPreviousData,
  })

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
