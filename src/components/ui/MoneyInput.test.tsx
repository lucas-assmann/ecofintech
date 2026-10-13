import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoneyInput } from './MoneyInput'

function Harness() {
  const [value, setValue] = useState<number | null>(null)
  return (
    <>
      <MoneyInput aria-label="Valor" value={value} onChange={setValue} />
      <output>{value === null ? 'vazio' : String(value)}</output>
    </>
  )
}

describe('MoneyInput', () => {
  it('os dígitos entram pela direita, como em app de banco', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Valor')

    await userEvent.type(input, '1250')

    expect((input as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('R$ 12,50')
    // Valor entregue ao formulário, em reais
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('apagar tudo deixa o campo vazio', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Valor')

    await userEvent.type(input, '5')
    await userEvent.clear(input)

    expect(screen.getByText('vazio')).toBeInTheDocument()
  })
})
