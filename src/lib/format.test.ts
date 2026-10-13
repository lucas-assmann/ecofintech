import { describe, expect, it } from 'vitest'
import {
  formatCpf,
  formatMoney,
  formatPhone,
  formatPlainDate,
  maskCpf,
} from './format'
import { isValidCpf } from './cpf'

// Intl usa espaço não separável entre "R$" e o número
const normalize = (s: string) => s.replace(/\s/g, ' ')

describe('formatMoney', () => {
  it('formata texto da API em reais', () => {
    expect(normalize(formatMoney('1234.5'))).toBe('R$ 1.234,50')
    expect(normalize(formatMoney('0.00'))).toBe('R$ 0,00')
  })
})

describe('formatCpf / maskCpf', () => {
  it('formata enquanto digita', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('529.982.247-2599')).toBe('529.982.247-25')
  })

  it('oculta parte do CPF', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**')
  })
})

describe('formatPhone', () => {
  it('formata fixo e celular', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })
})

describe('formatPlainDate', () => {
  it('não sofre com fuso horário', () => {
    expect(formatPlainDate('1995-08-20')).toBe('20/08/1995')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF válido com ou sem pontuação', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('recusa dígito errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
})
