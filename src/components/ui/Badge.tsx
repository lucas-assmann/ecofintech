import type { ReactNode } from 'react'

const tones = {
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  green: 'bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-300',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
  amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  blue: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200',
} as const

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof tones
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
