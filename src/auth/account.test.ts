import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { setToken } from './session'
import {
  ACCOUNT_REVOKED_EVENT,
  getActiveAccountId,
  setActiveAccountId,
} from './account'

const COMPANY = '22222222-2222-4222-8222-222222222222'

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('conta ativa', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setActiveAccountId(null)
  })

  it('envia X-Account-Id quando há uma conta escolhida', async () => {
    setToken('meu-token')
    setActiveAccountId(COMPANY)
    const fetch = mockFetch(200, {})

    await api.GET('/accounts/me')

    const request = fetch.mock.calls[0][0] as Request
    expect(request.headers.get('X-Account-Id')).toBe(COMPANY)
  })

  it('sem conta escolhida, não envia o cabeçalho (vale a pessoal)', async () => {
    setToken('meu-token')
    const fetch = mockFetch(200, {})

    await api.GET('/accounts/me')

    const request = fetch.mock.calls[0][0] as Request
    expect(request.headers.has('X-Account-Id')).toBe(false)
  })

  it('403 "Sem acesso a esta conta" volta para a pessoal e avisa o app', async () => {
    setToken('meu-token')
    setActiveAccountId(COMPANY)
    mockFetch(403, { message: 'Sem acesso a esta conta', statusCode: 403 })
    const listener = vi.fn()
    window.addEventListener(ACCOUNT_REVOKED_EVENT, listener)

    await api.GET('/transactions', { params: { query: { limit: 5, offset: 0 } } })

    expect(getActiveAccountId()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(ACCOUNT_REVOKED_EVENT, listener)
  })

  it('outro 403 (ex.: rota de admin) não mexe na conta escolhida', async () => {
    setToken('meu-token')
    setActiveAccountId(COMPANY)
    mockFetch(403, { message: 'Acesso restrito', statusCode: 403 })

    await api.GET('/users')

    expect(getActiveAccountId()).toBe(COMPANY)
  })
})
