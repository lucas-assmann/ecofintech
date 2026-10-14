import { describe, expect, it } from 'vitest'
import { moneyOperationSchema, toRequestBody } from './money-operation'

const base = { amount: 50, description: '' }

describe('destinatário por CNPJ', () => {
  it('envia só os dígitos em to_cnpj', () => {
    const values = moneyOperationSchema.parse({
      ...base,
      mode: 'cnpj',
      recipient: '11.222.333/0001-81',
    })

    expect(toRequestBody(values)).toEqual({ to_cnpj: '11222333000181', amount: 50 })
  })

  it('recusa CNPJ inválido com mensagem própria', () => {
    const result = moneyOperationSchema.safeParse({
      ...base,
      mode: 'cnpj',
      recipient: '11.222.333/0001-82',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('CNPJ inválido')
  })
})
