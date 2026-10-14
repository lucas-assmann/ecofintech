import { Link } from 'react-router'
import { useInvites } from '../api/queries'
import { BellIcon } from './icons'

/** Sininho com o número de convites pendentes; leva para a tela de contas. */
export function InvitesBell() {
  const invites = useInvites()
  const count = invites.data?.length ?? 0

  return (
    <Link
      to="/contas"
      aria-label={count > 0 ? `${count} convite(s) pendente(s)` : 'Sem convites pendentes'}
      title="Convites"
      className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <BellIcon />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  )
}
