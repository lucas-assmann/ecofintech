import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServerWakeBanner } from './ServerWakeBanner'

const ok = () => new Response('{}', { status: 200 })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ServerWakeBanner', () => {
  it('não mostra nada quando a API responde rápido', async () => {
    const fetch = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetch)

    render(<ServerWakeBanner slowAfterMs={50} />)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('avisa enquanto a API acorda e some quando ela responde', async () => {
    // Duas falhas (Render ainda ligando) e depois sucesso
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetch)

    render(<ServerWakeBanner slowAfterMs={0} retryMs={30} />)

    expect(await screen.findByText('Ligando o servidor...')).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(screen.queryByText('Ligando o servidor...')).not.toBeInTheDocument(),
    )
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('desiste depois do limite e permite tentar de novo', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)

    render(<ServerWakeBanner slowAfterMs={0} retryMs={10} giveUpMs={50} />)

    expect(
      await screen.findByText('Não foi possível conectar ao servidor'),
    ).toBeInTheDocument()

    fetch.mockResolvedValue(ok())
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await vi.waitFor(() =>
      expect(
        screen.queryByText('Não foi possível conectar ao servidor'),
      ).not.toBeInTheDocument(),
    )
  })
})
