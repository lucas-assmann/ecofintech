import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

const variants = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700',
  secondary:
    'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus-visible:outline-slate-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-slate-500',
  // Ação destrutiva discreta (ex.: "Remover" numa linha de tabela)
  'danger-ghost':
    'text-red-700 hover:bg-red-50 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950/40',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  loading?: boolean
  full?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  full = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
