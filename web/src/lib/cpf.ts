import { onlyDigits } from './format'

/**
 * Confere os dígitos verificadores do CPF (mesma regra da API), para avisar
 * o usuário antes de enviar.
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split('').map(Number)
  for (const position of [9, 10]) {
    const sum = digits
      .slice(0, position)
      .reduce((acc, digit, i) => acc + digit * (position + 1 - i), 0)
    if (((sum * 10) % 11) % 10 !== digits[position]) return false
  }
  return true
}
