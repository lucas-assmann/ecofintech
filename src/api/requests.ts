import { api, ApiError, type Schemas, unwrap } from './client'
import type { operations } from './schema'

// ---------- Auth ----------

export const login = async (body: Schemas['LoginDto']) =>
  unwrap(await api.POST('/auth/login', { body }))

export const logout = async () => unwrap(await api.POST('/auth/logout'))

export const getMe = async () => unwrap(await api.GET('/auth/me'))

/** Pede o e-mail com o link de redefinição (resposta igual exista ou não a conta). */
export const forgotPassword = async (body: Schemas['ForgotPasswordDto']) =>
  unwrap(await api.POST('/auth/forgot-password', { body }))

/** Nova senha usando o token do link do e-mail. */
export const resetPassword = async (body: Schemas['ResetPasswordDto']) =>
  unwrap(await api.POST('/auth/reset-password', { body }))

// ---------- Usuários ----------

export const register = async (body: Schemas['CreateUserDto']) =>
  unwrap(await api.POST('/users', { body }))

export const updateUser = async (id: string, body: Schemas['UpdateUserDto']) =>
  unwrap(await api.PATCH('/users/{id}', { params: { path: { id } }, body }))

export const changePassword = async (
  id: string,
  body: Schemas['UpdatePasswordDto'],
) =>
  unwrap(
    await api.PATCH('/users/{id}/password', { params: { path: { id } }, body }),
  )

export const listUsers = async () => unwrap(await api.GET('/users'))

export const deleteUser = async (id: string) =>
  unwrap(await api.DELETE('/users/{id}', { params: { path: { id } } }))

// ---------- Conta ----------

export const getMyAccount = async () => unwrap(await api.GET('/accounts/me'))

// ---------- Movimentações ----------

export const listTransactions = async (query: {
  limit: number
  offset: number
}) => unwrap(await api.GET('/transactions', { params: { query } }))

export type SummaryDays = 7 | 30 | 90

/** Totais de entradas e saídas do período, para o dashboard. */
export const getSummary = async (days: SummaryDays) =>
  unwrap(await api.GET('/transactions/summary', { params: { query: { days } } }))

type ListAllQuery =
  operations['TransactionsController_findAllAdmin']['parameters']['query']

/** Filtros da listagem geral (sem a paginação). */
export type AdminTransactionFilters = Omit<ListAllQuery, 'limit' | 'offset'>

/** Todos os lançamentos do sistema (admin), com filtros. */
export const listAllTransactions = async (query: ListAllQuery) =>
  unwrap(await api.GET('/transactions/all', { params: { query } }))

export const getTransaction = async (id: string) =>
  unwrap(await api.GET('/transactions/{id}', { params: { path: { id } } }))

/** A chave de idempotência garante que a mesma transferência não seja feita duas vezes. */
export const transfer = async (
  idempotencyKey: string,
  body: Schemas['TransferDto'],
) =>
  unwrap(
    await api.POST('/transactions/transfer', {
      params: { header: { 'Idempotency-Key': idempotencyKey } },
      body,
    }),
  )

export const deposit = async (
  idempotencyKey: string,
  body: Schemas['DepositDto'],
) =>
  unwrap(
    await api.POST('/transactions/deposit', {
      params: { header: { 'Idempotency-Key': idempotencyKey } },
      body,
    }),
  )

export const reverseTransaction = async (
  id: string,
  body: Schemas['ReverseTransactionDto'],
) =>
  unwrap(
    await api.POST('/transactions/{id}/reverse', {
      params: { path: { id } },
      body,
    }),
  )

// ---------- Desativação de conta ----------

export const requestDeactivation = async (
  body: Schemas['CreateDeactivationRequestDto'],
) => unwrap(await api.POST('/deactivation-requests', { body }))

/** Última solicitação do usuário, ou null se ele nunca pediu. */
export const getMyDeactivation = async () => {
  try {
    return unwrap(await api.GET('/deactivation-requests/me'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const listDeactivations = async (
  status?: Schemas['deactivation_request_status'],
) =>
  unwrap(
    await api.GET('/deactivation-requests', {
      params: { query: status ? { status } : {} },
    }),
  )

export const approveDeactivation = async (id: string, note?: string) =>
  unwrap(
    await api.PATCH('/deactivation-requests/{id}/approve', {
      params: { path: { id } },
      body: { note },
    }),
  )

export const rejectDeactivation = async (id: string, note?: string) =>
  unwrap(
    await api.PATCH('/deactivation-requests/{id}/reject', {
      params: { path: { id } },
      body: { note },
    }),
  )
