import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/context'
import { firstName } from '../lib/format'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { AccountSwitcher } from './AccountSwitcher'
import { InvitesBell } from './InvitesBell'
import { Alert } from './ui/Alert'
import { useActiveAccount } from '../auth/account-context'
import {
  HomeIcon,
  ListIcon,
  LogoutIcon,
  SendIcon,
  BuildingIcon,
  ShieldIcon,
  UserIcon,
} from './icons'

const userLinks = [
  { to: '/', label: 'Início', icon: HomeIcon, end: true },
  { to: '/transferir', label: 'Transferir', icon: SendIcon },
  { to: '/extrato', label: 'Extrato', icon: ListIcon },
  { to: '/perfil', label: 'Perfil', icon: UserIcon },
]

const adminLinks = [
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/deposito', label: 'Depósito' },
  { to: '/admin/desativacoes', label: 'Desativações' },
  { to: '/admin/lancamentos', label: 'Lançamentos' },
  { to: '/admin/estorno', label: 'Estorno' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
  }`

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { active, revokedNotice } = useActiveAccount()

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <NavLink to="/" aria-label="Ecofintech, início">
            <Logo compact />
          </NavLink>

          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {userLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                <Icon />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-slate-600 dark:text-slate-400 xl:inline">
              Olá, <strong className="text-slate-900 dark:text-slate-100">{firstName(user?.name ?? '')}</strong>
            </span>
            <AccountSwitcher />
            <InvitesBell />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Sair"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            >
              <LogoutIcon />
              <span className="hidden lg:inline">Sair</span>
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-900">
            <nav
              aria-label="Administração"
              className="mx-auto flex max-w-[1680px] items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8"
            >
              <span className="mr-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
                <ShieldIcon className="size-4" />
                Admin
              </span>
              {adminLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        {/* Com dinheiro não pode haver dúvida de qual conta está em uso */}
        {active?.kind === 'company' && (
          <div className="border-t border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/60">
            <p className="mx-auto flex max-w-[1680px] items-center gap-2 px-4 py-2 text-sm text-sky-900 sm:px-6 lg:px-8 dark:text-sky-100">
              <BuildingIcon className="size-4 shrink-0" />
              <span className="truncate">
                Você está operando como <strong>{active.name}</strong>
              </span>
            </p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {revokedNotice && (
          <div className="mb-6">
            <Alert tone="warning">{revokedNotice}</Alert>
          </div>
        )}
        <Outlet />
      </main>

      {/* Navegação inferior no celular */}
      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {userLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
