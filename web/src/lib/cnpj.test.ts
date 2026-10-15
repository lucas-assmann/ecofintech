import { describe, expect, it } from 'vitest'
import { isValidCnpj } from './cnpj'

describe('isValidCnpj', () => {
  it.each(['11222333000181', '00000000000191', '11.222.333/0001-81', ' 00.000.000/0001-91 '])(
    'aceita CNPJ válido (com ou sem pontuação) %s',
    (cnpj) => expect(isValidCnpj(cnpj)).toBe(true),
  )

  it.each([
    ['dígito verificador errado', '11222333000182'],
    ['todos os dígitos iguais', '11111111111111'],
    ['menos de 14 dígitos', '1122233300018'],
  ])('recusa %s', (_motivo, cnpj) => expect(isValidCnpj(cnpj)).toBe(false))
})
