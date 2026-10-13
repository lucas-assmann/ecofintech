import type { ReactNode } from 'react'

const styles = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-brand-50 text-brand-900 ring-brand-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
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
