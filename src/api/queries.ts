import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as requests from './requests'

// Chaves de cache: invalidar uma delas faz a tela buscar de novo
export const queryKeys = {
  account: ['account'] as const,
  transactions: ['transactions'] as const,
  transactionsPage: (limit: number, offset: number) =>
    ['transactions', limit, offset] as const,
  myDeactivation: ['deactivation', 'me'] as const,
  users: ['admin', 'users'] as const,
  deactivations: (status?: string) =>
    ['admin', 'deactivations', status ?? 'all'] as const,
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

export const useMyDeactivation = () =>
  useQuery({
    queryKey: queryKeys.myDeactivation,
    queryFn: requests.getMyDeactivation,
  })
