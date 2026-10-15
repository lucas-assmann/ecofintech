import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, unwrap } from './client'
import { getToken, SESSION_EXPIRED_EVENT, setToken } from '../auth/session'

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('cliente da API', () => {
  afterEach(() => vi.restoreAllMocks())

  it('envia o token no header Authorization', async () => {
    setToken('meu-token')
    const fetch = mockFetch(200, { id: '1' })

    await api.GET('/auth/me')

    const request = fetch.mock.calls[0][0] as Request
    expect(request.headers.get('Authorization')).toBe('Bearer meu-token')
  })

  it('401 numa rota protegida encerra a sessão e avisa o app', async () => {
    setToken('token-velho')
    mockFetch(401, { message: 'Sessão expirada. Faça login novamente.' })
    const listener = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener)

    await api.GET('/accounts/me')

    expect(listener).toHaveBeenCalledOnce()
    expect(getToken()).toBeNull()
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })

  it('401 no login é só "senha errada": não dispara a expiração', async () => {
    mockFetch(401, { message: 'E-mail ou senha inválidos' })
    const listener = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener)

    const result = await api.POST('/auth/login', {
      body: { email: 'a@b.com', password: 'x' },
    })

    expect(listener).not.toHaveBeenCalled()
    expect(() => unwrap(result)).toThrow('E-mail ou senha inválidos')
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })

  it('unwrap junta mensagens de validação da API', async () => {
    mockFetch(400, { message: ['cpf inválido', 'phone inválido'] })

    const result = await api.POST('/users', {
      body: {
        name: 'X',
        email: 'x@x.com',
        date_of_birth: '1990-01-01',
        cpf: '1',
        phone: '1',
        password: '12345678',
      },
    })

    expect(() => unwrap(result)).toThrow(
      new ApiError(400, 'cpf inválido. phone inválido'),
    )
  })
})
