import type { ReactNode } from 'react'

const styles = {
  error: 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 ring-red-200 dark:ring-red-900',
  success: 'bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 ring-brand-200 dark:ring-brand-900',
  info: 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 ring-sky-200 dark:ring-sky-900',
  warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 ring-amber-200 dark:ring-amber-900',
} as const

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof styles
  title?: string
  children?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl px-4 py-3 text-sm ring-1 ${styles[tone]}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  )
}
