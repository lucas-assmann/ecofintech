import type { ReactNode } from 'react'

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 sm:p-6 ${className}`}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && <p className="mt-1 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-6 py-10 text-center">
      <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  )
}
