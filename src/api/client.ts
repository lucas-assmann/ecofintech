import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'
import { expireSession, getToken } from '../auth/session'

export type Schemas = components['schemas']
export type User = Schemas['User']
export type Account = Schemas['Account']
export type Transaction = Schemas['Transaction']
export type DeactivationRequest = Schemas['DeactivationRequest']

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/**
 * Cliente tipado da API. Os tipos vêm de src/api/schema.d.ts, gerado a partir
 * do Swagger da API (npm run api:types): se uma rota mudar, o TypeScript acusa.
 */
export const api = createClient<paths>({
  baseUrl: API_URL,
  // Busca o fetch global a cada chamada (permite substituí-lo nos testes)
  fetch: (request) => globalThis.fetch(request),
})

const auth: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ request, response }) {
    // 401 com sessão aberta = a sessão não vale mais: volta para o login.
    // (No próprio login, 401 é só "e-mail ou senha inválidos".)
    const isLogin = new URL(request.url).pathname === '/auth/login'
    if (response.status === 401 && !isLogin && getToken()) expireSession()
    return response
  },
}
api.use(auth)

/** Erro devolvido pela API, com o status HTTP e a mensagem já em texto. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const FALLBACK = 'Não foi possível completar a operação. Tente novamente.'

/**
 * Transforma a resposta do openapi-fetch em dado ou exceção.
 * A API devolve erros como { message: string | string[] }.
 */
export function unwrap<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): T {
  if (result.error !== undefined || !result.response.ok) {
    const body = result.error as { message?: string | string[] } | undefined
    const message = Array.isArray(body?.message)
      ? body.message.join('. ')
      : (body?.message ?? FALLBACK)
    throw new ApiError(result.response.status, message)
  }
  return result.data as T
}

/** Mensagem amigável para qualquer erro (da API ou de rede). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
  }
  return FALLBACK
}

/** true quando a falha foi de rede (a requisição pode ou não ter chegado na API). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError
}
