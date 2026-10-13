import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/context'
import { firstName } from '../lib/format'
import { Logo } from './Logo'
import {
  HomeIcon,
  ListIcon,
  LogoutIcon,
  SendIcon,
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
  { to: '/admin/estorno', label: 'Estorno' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" aria-label="Ecofintech, início">
            <Logo />
          </NavLink>

          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {userLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                <Icon />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">
              Olá, <strong className="text-slate-900">{firstName(user?.name ?? '')}</strong>
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="border-t border-slate-200 bg-slate-900">
            <nav
              aria-label="Administração"
              className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5"
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
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Navegação inferior no celular */}
      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {userLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-brand-700' : 'text-slate-500'
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
