import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './icons'

/** Botão que alterna entre tema claro e escuro (a escolha fica salva no navegador). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      className={`rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
