import { formatCpf } from '../lib/format'
import { Input } from './ui/Field'

export type RecipientMode = 'email' | 'cpf'

/** Escolha entre e-mail e CPF + o campo correspondente. */
export function RecipientField({
  id,
  mode,
  onModeChange,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  mode: RecipientMode
  onModeChange: (mode: RecipientMode) => void
  value: string
  onChange: (value: string) => void
  invalid: boolean
  describedBy?: string
}) {
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Identificar destinatário por"
        className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
      >
        {(['email', 'cpf'] as const).map((option) => (
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
            {option === 'email' ? 'E-mail' : 'CPF'}
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
        placeholder={mode === 'email' ? 'fulano@email.com' : '000.000.000-00'}
        value={value}
        onChange={(e) =>
          onChange(mode === 'cpf' ? formatCpf(e.target.value) : e.target.value)
        }
      />
    </div>
  )
}
