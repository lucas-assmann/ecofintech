import { Link, useNavigate } from 'react-router'
import type { OperableAccount } from '../api/client'
import { useInvites } from '../api/queries'
import { useActiveAccount } from '../auth/account-context'
import { formatCnpj, formatCpf, formatMoney } from '../lib/format'
import { InviteList } from '../components/InviteList'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/Card'
import { Loading } from '../components/ui/Spinner'
import { BuildingIcon, PlusIcon, UserIcon } from '../components/icons'

/** Escolha da conta com que operar: aparece logo após o login para quem tem empresa. */
export function AccountsPage() {
  const { accounts, active, loading, switchTo } = useActiveAccount()
  const invites = useInvites()
  const navigate = useNavigate()

  const choose = (account: OperableAccount) => {
    switchTo(account.id)
    navigate('/', { replace: true })
  }

  if (loading) return <Loading label="Carregando suas contas..." />

  return (
    <div className="space-y-8">
      <PageHeader
        title="Com qual conta você quer operar?"
        description="Você pode trocar a qualquer momento pelo seletor no topo da tela."
      />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const company = account.kind === 'company'
          const Icon = company ? BuildingIcon : UserIcon
          const isActive = account.id === active?.id
          return (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => choose(account)}
                aria-current={isActive}
                className={`flex h-full w-full items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 transition hover:ring-2 hover:ring-brand-600 dark:bg-slate-900 ${
                  isActive
                    ? 'ring-2 ring-brand-600'
                    : 'ring-slate-200 dark:ring-slate-800'
                }`}
              >
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-full ${
                    company
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                      : 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400'
                  }`}
                >
                  <Icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {account.name}
                    </span>
                    {company ? (
                      <Badge tone="blue">{account.role === 'owner' ? 'Dono' : 'Membro'}</Badge>
                    ) : (
                      <Badge tone="green">Pessoal</Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    {company
                      ? `CNPJ ${formatCnpj(account.document)}`
                      : `CPF ${formatCpf(account.document)}`}
                  </span>
                  <span className="mt-3 block text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatMoney(account.balance)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <Link
            to="/empresa/nova"
            className="flex h-full min-h-28 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-5 font-semibold text-slate-600 hover:border-brand-600 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-400"
          >
            <PlusIcon />
            Abrir conta de empresa
          </Link>
        </li>
      </ul>

      {invites.data && invites.data.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Convites para participar de empresas
          </h2>
          <InviteList invites={invites.data} />
        </section>
      )}
    </div>
  )
}
