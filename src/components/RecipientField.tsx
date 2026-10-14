import { formatCnpj, formatCpf } from '../lib/format'
import { Input } from './ui/Field'

export type RecipientMode = 'email' | 'cpf' | 'cnpj'

const options = {
  email: { label: 'E-mail', placeholder: 'fulano@email.com', format: (v: string) => v },
  cpf: { label: 'CPF', placeholder: '000.000.000-00', format: formatCpf },
  cnpj: { label: 'CNPJ', placeholder: '00.000.000/0000-00', format: formatCnpj },
} as const

/** Escolha entre e-mail, CPF e CNPJ (empresa) + o campo correspondente. */
export function RecipientField({
  id,
  mode,
  onModeChange,
  value,
  onChange,
  invalid,
  describedBy,
  modes = ['email', 'cpf', 'cnpj'],
}: {
  id: string
  mode: RecipientMode
  onModeChange: (mode: RecipientMode) => void
  value: string
  onChange: (value: string) => void
  invalid: boolean
  describedBy?: string
  /** Quais formas aparecem (ex.: convite só aceita pessoas: e-mail e CPF) */
  modes?: RecipientMode[]
}) {
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Identificar destinatário por"
        className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
      >
        {modes.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => {
              onModeChange(option)
              onChange('')
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              mode === option
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {options[option].label}
          </button>
        ))}
      </div>
      <Input
        id={id}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        type={mode === 'email' ? 'email' : 'text'}
        inputMode={mode === 'email' ? 'email' : 'numeric'}
        autoComplete="off"
        placeholder={options[mode].placeholder}
        value={value}
        onChange={(e) => onChange(options[mode].format(e.target.value))}
      />
    </div>
  )
}
