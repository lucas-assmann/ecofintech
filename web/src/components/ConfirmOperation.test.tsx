import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Transaction } from '../api/client'
import { ApiError } from '../api/client'
import { ConfirmOperation } from './ConfirmOperation'

const values = {
  mode: 'email' as const,
  recipient: 'fulano@email.com',
  amount: 50,
  description: '',
}

const transaction = { id: 'tx-1' } as Transaction

describe('ConfirmOperation', () => {
  it('após falha de rede, tenta de novo com a MESMA chave de idempotência', async () => {
    const execute = vi
      .fn<(key: string) => Promise<Transaction>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(transaction)
    const onDone = vi.fn()

    render(
      <ConfirmOperation
        values={values}
        confirmLabel="Confirmar"
        execute={execute}
        onBack={vi.fn()}
        onDone={onDone}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(
      await screen.findByText(/Tentar de novo é seguro/),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(execute).toHaveBeenCalledTimes(2)
    const [firstKey] = execute.mock.calls[0]
    const [secondKey] = execute.mock.calls[1]
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondKey).toBe(firstKey)
    expect(onDone).toHaveBeenCalledWith(transaction)
  })

  it('mostra o erro da API (ex.: saldo insuficiente) sem sugerir nova tentativa', async () => {
    const execute = vi.fn().mockRejectedValue(new ApiError(422, 'Saldo insuficiente'))

    render(
      <ConfirmOperation
        values={values}
        confirmLabel="Confirmar"
        execute={execute}
        onBack={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Saldo insuficiente')).toBeInTheDocument()
    expect(screen.queryByText(/Tentar de novo é seguro/)).not.toBeInTheDocument()
  })

  it('cada nova confirmação (novo componente) recebe uma chave nova', async () => {
    const execute = vi.fn().mockResolvedValue(transaction)
    const props = {
      values,
      confirmLabel: 'Confirmar',
      execute,
      onBack: vi.fn(),
      onDone: vi.fn(),
    }

    const { unmount } = render(<ConfirmOperation {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    unmount()
    render(<ConfirmOperation {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(execute.mock.calls[0][0]).not.toBe(execute.mock.calls[1][0])
  })

  it('mostra de qual conta o dinheiro sai, quando informado', () => {
    render(
      <ConfirmOperation
        values={values}
        from="Padaria Pão Bom"
        confirmLabel="Confirmar"
        execute={vi.fn()}
        onBack={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('De')).toBeInTheDocument()
    expect(screen.getByText('Padaria Pão Bom')).toBeInTheDocument()
  })
})
