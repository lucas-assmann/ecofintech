import { inputClass } from './Field'
import { formatMoney } from '../../lib/format'

interface MoneyInputProps {
  id?: string
  /** Valor em reais (ex.: 12.5) ou null quando vazio */
  value: number | null
  onChange: (value: number | null) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  disabled?: boolean
}

/**
 * Campo de valor que funciona como em apps de banco: os dígitos entram pela
 * direita (digitar 1, 2, 5, 0 mostra R$ 12,50). Evita erros com vírgula e ponto.
 */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  const cents = value === null ? 0 : Math.round(value * 100)

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={`${inputClass} tabular text-lg font-semibold`}
      value={value === null ? '' : formatMoney(cents / 100)}
      placeholder="R$ 0,00"
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 11)
        onChange(digits ? Number(digits) / 100 : null)
      }}
    />
  )
}
