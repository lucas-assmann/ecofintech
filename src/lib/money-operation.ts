import { z } from 'zod'
import type { Schemas } from '../api/client'
import { isValidCnpj } from './cnpj'
import { isValidCpf } from './cpf'
import { onlyDigits } from './format'

/**
 * Formulário comum a transferência e depósito: destinatário (e-mail, CPF ou CNPJ),
 * valor e descrição.
 */
export const moneyOperationSchema = z
  .object({
    mode: z.enum(['email', 'cpf', 'cnpj']),
    recipient: z.string().trim().min(1, 'Informe o destinatário'),
    amount: z
      .number({ error: 'Informe o valor' })
      .min(0.01, 'Informe o valor')
      .max(1_000_000, 'O limite por operação é R$ 1.000.000,00'),
    description: z.string().trim().max(140, 'Máximo de 140 caracteres'),
  })
  .superRefine((data, ctx) => {
    const rules = {
      email: [z.email().safeParse(data.recipient).success, 'E-mail inválido'],
      cpf: [isValidCpf(data.recipient), 'CPF inválido'],
      cnpj: [isValidCnpj(data.recipient), 'CNPJ inválido'],
    } as const
    const [valid, message] = rules[data.mode]
    if (!valid) ctx.addIssue({ code: 'custom', path: ['recipient'], message })
  })

export type MoneyOperationValues = z.infer<typeof moneyOperationSchema>

/** Monta o corpo da requisição com to_email, to_cpf OU to_cnpj (a API exige só um). */
export function toRequestBody(
  values: MoneyOperationValues,
): Schemas['TransferDto'] {
  return {
    ...(values.mode === 'email'
      ? { to_email: values.recipient.toLowerCase() }
      : values.mode === 'cpf'
        ? { to_cpf: onlyDigits(values.recipient) }
        : { to_cnpj: onlyDigits(values.recipient) }),
    amount: values.amount,
    ...(values.description ? { description: values.description } : {}),
  }
}

/**
 * Chave de idempotência: uma por operação confirmada. Reenviar com a mesma
 * chave nunca repete a operação na API.
 */
export const newIdempotencyKey = () => crypto.randomUUID()
