export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Carregamento de página inteira ou de uma seção */
export function Loading({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
