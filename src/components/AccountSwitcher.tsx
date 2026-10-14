import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useActiveAccount } from '../auth/account-context'
import { BuildingIcon, CheckIcon, ChevronDownIcon, PlusIcon, UserIcon } from './icons'

const itemClass =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

/** Mostra com qual conta a pessoa está operando e permite trocar. */
export function AccountSwitcher() {
  const { accounts, active, switchTo } = useActiveAccount()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!active) return null
  const company = active.kind === 'company'
  const Icon = company ? BuildingIcon : UserIcon

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Conta ativa: ${active.name}. Trocar de conta`}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        <Icon className={`size-5 ${company ? 'text-sky-700 dark:text-sky-300' : 'text-brand-700 dark:text-brand-400'}`} />
        <span className="max-w-[7rem] truncate sm:max-w-[12rem]">{active.name}</span>
        <span
          className={`hidden rounded-md px-1.5 py-0.5 text-xs font-semibold sm:inline ${
            company
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
              : 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300'
          }`}
        >
          {company ? 'Empresa' : 'Pessoal'}
        </span>
        <ChevronDownIcon className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Operar como
          </p>
          {accounts.map((account) => {
            const ItemIcon = account.kind === 'company' ? BuildingIcon : UserIcon
            const isActive = account.id === active.id
            return (
              <button
                key={account.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setOpen(false)
                  if (!isActive) {
                    switchTo(account.id)
                    navigate('/')
                  }
                }}
                className={itemClass}
              >
                <ItemIcon className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{account.name}</span>
                {isActive && <CheckIcon className="size-4 text-brand-700 dark:text-brand-400" />}
              </button>
            )
          })}
          <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
          {company && (
            <Link to="/empresa" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <BuildingIcon className="size-5" />
              Gerenciar empresa
            </Link>
          )}
          <Link to="/empresa/nova" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <PlusIcon className="size-5" />
            Abrir conta de empresa
          </Link>
        </div>
      )}
    </div>
  )
}
