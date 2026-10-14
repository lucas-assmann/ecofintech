import { onlyDigits } from './format'

// Pesos oficiais dos dois dígitos verificadores
const WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
]

/**
 * Confere os dígitos verificadores do CNPJ (mesma regra da API), para avisar
 * o usuário antes de enviar. Aceita com ou sem pontuação.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value)
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false

  const digits = cnpj.split('').map(Number)
  return WEIGHTS.every((weights) => {
    const sum = weights.reduce((acc, weight, i) => acc + digits[i] * weight, 0)
    const rest = sum % 11
    return (rest < 2 ? 0 : 11 - rest) === digits[weights.length]
  })
}
