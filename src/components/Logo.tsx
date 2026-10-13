export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? '#ecfdf5' : '#047857'} />
        <path
          d="M9 22c0-8 5.5-13 15-13-.5 9.5-5.5 15-13 15"
          fill="none"
          stroke={light ? '#047857' : '#ecfdf5'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 24c3-4 6-7 10-9"
          fill="none"
          stroke={light ? '#047857' : '#ecfdf5'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}
      >
        Ecofintech
      </span>
    </span>
  )
}
