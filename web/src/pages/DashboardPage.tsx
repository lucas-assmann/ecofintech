import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/context'
import { useAccount, useMyDeactivation, useSummary, useTransactions } from '../api/queries'
import type { TransactionSummary } from '../api/client'
import { errorMessage } from '../api/client'
import type { SummaryDays } from '../api/requests'
import { firstName, formatMoney } from '../lib/format'
import { CashFlowChart } from '../components/CashFlowChart'
import { TransactionList } from '../components/TransactionList'
import { Alert } from '../components/ui/Alert'
import { Card, EmptyState } from '../components/ui/Card'
import { Loading } from '../components/ui/Spinner'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  ListIcon,
  SendIcon,
  TrendDownIcon,
  TrendUpIcon,
  UserIcon,
} from '../components/icons'

// Preferência de mostrar/ocultar o saldo (só conveniência deste navegador)
const HIDE_KEY = 'ecofintech.hideBalance'
const readHidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

const periods: { days: SummaryDays; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const account = useAccount()
  const recent = useTransactions(6)
  const deactivation = useMyDeactivation()
  const [hidden, setHidden] = useState(readHidden)
  const [days, setDays] = useState<SummaryDays>(30)
  const summary = useSummary(days)

  const toggleHidden = () => {
    setHidden((value) => {
      try {
        localStorage.setItem(HIDE_KEY, value ? '0' : '1')
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !value
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {firstName(user?.name ?? '')}
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Veja quanto entrou e saiu da sua conta.</p>
        </div>

        {/* O período vale para os totais, o gráfico e as categorias abaixo */}
        <div
          role="radiogroup"
          aria-label="Período"
          className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1"
        >
          {periods.map((p) => (
            <button
              key={p.days}
              type="button"
              role="radio"
              aria-checked={days === p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                days === p.days
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {deactivation.data?.status === 'pending' && (
        <Alert tone="warning" title="Solicitação de encerramento em análise">
          O suporte avaliará a solicitação. Acompanhe em{' '}
          <Link to="/perfil" className="font-semibold underline">
            Perfil
          </Link>
          .
        </Alert>
      )}

      {/* Celular: saldo, resumo, últimas. Telas largas: resumo à esquerda,
          saldo e últimas movimentações numa coluna à direita. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:grid-rows-[auto_1fr]">
        <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-6 text-white shadow-lg xl:col-start-3 xl:row-start-1">
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 size-56 rounded-full bg-brand-700/70"
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-brand-100">Saldo disponível</p>
              <button
                type="button"
                onClick={toggleHidden}
                aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
                className="rounded-lg p-1.5 text-brand-100 hover:bg-white/10"
              >
                {hidden ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {account.isPending
                ? '...'
                : account.isError
                  ? '—'
                  : hidden
                    ? 'R$ ••••••'
                    : formatMoney(account.data.balance)}
            </p>
            {account.isError && (
              <p className="mt-2 text-sm text-brand-100">{errorMessage(account.error)}</p>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { to: '/transferir', label: 'Transferir', icon: SendIcon },
                { to: '/extrato', label: 'Extrato', icon: ListIcon },
                { to: '/perfil', label: 'Perfil', icon: UserIcon },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 px-2 py-3 text-sm font-medium hover:bg-white/20"
                >
                  <Icon className="size-6" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="min-w-0 space-y-6 xl:col-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          {summary.isPending ? (
            <Card>
              <Loading />
            </Card>
          ) : summary.isError ? (
            <Alert tone="error">{errorMessage(summary.error)}</Alert>
          ) : (
            // Ao trocar o período, mantém o resumo anterior (apagado) até o novo chegar
            <div
              className={`space-y-6 transition ${summary.isPlaceholderData ? 'opacity-60' : ''}`}
            >
              <Totals summary={summary.data} hidden={hidden} />
              <Card
                title="Entradas e saídas"
                description={
                  summary.data.bucket === 'week'
                    ? 'Total de cada semana. Passe o mouse para ver os valores.'
                    : 'Total de cada dia. Passe o mouse para ver os valores.'
                }
              >
                <CashFlowChart summary={summary.data} />
              </Card>
              <div className="grid gap-6 md:grid-cols-2">
                <Card title="De onde veio">
                  <Breakdown summary={summary.data} type="entrada" />
                </Card>
                <Card title="Para onde foi">
                  <Breakdown summary={summary.data} type="saida" />
                </Card>
              </div>
            </div>
          )}
        </div>

        <Card
          className="xl:col-start-3 xl:row-start-2"
          title="Últimas movimentações"
          actions={
            <Link to="/extrato" className="text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
              Ver extrato
            </Link>
          }
        >
          {recent.isPending ? (
            <Loading />
          ) : recent.isError ? (
            <Alert tone="error">{errorMessage(recent.error)}</Alert>
          ) : recent.data.length === 0 ? (
            <EmptyState title="Nenhuma movimentação ainda">
              Quando você receber ou enviar dinheiro, aparece aqui.
            </EmptyState>
          ) : (
            <TransactionList items={recent.data} />
          )}
        </Card>
      </div>
    </div>
  )
}

/** Três números do período: quanto entrou, quanto saiu e o que sobrou. */
function Totals({ summary, hidden }: { summary: TransactionSummary; hidden: boolean }) {
  const net = Number(summary.resultado)
  const money = (value: string | number) => (hidden ? 'R$ ••••' : formatMoney(value))

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile
        label="Entradas"
        icon={<ArrowDownIcon className="size-4" />}
        marker="bg-entrada"
        value={money(summary.total_entradas)}
        caption="Tudo o que chegou na conta"
      />
      <StatTile
        label="Saídas"
        icon={<ArrowUpIcon className="size-4" />}
        marker="bg-saida"
        value={money(summary.total_saidas)}
        caption="Tudo o que saiu da conta"
      />
      <StatTile
        label="Resultado"
        icon={net < 0 ? <TrendDownIcon className="size-4" /> : <TrendUpIcon className="size-4" />}
        value={hidden ? 'R$ ••••' : `${net > 0 ? '+ ' : net < 0 ? '− ' : ''}${formatMoney(Math.abs(net))}`}
        caption={
          net > 0
            ? 'Entrou mais do que saiu'
            : net < 0
              ? 'Saiu mais do que entrou'
              : 'Entradas e saídas empataram'
        }
        tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined}
      />
    </div>
  )
}

const neutralStyle = {
  card: 'bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
  icon: 'bg-slate-500',
  value: 'text-slate-900 dark:text-slate-100',
}

const toneStyles = {
  good: {
    card: 'bg-brand-50 ring-brand-200 dark:bg-brand-950/50 dark:ring-brand-800',
    icon: 'bg-brand-600',
    value: 'text-brand-700 dark:text-brand-400',
  },
  bad: {
    card: 'bg-red-50 ring-red-200 dark:bg-red-950/40 dark:ring-red-900',
    icon: 'bg-red-600',
    value: 'text-red-700 dark:text-red-400',
  },
}

function StatTile({
  label,
  value,
  caption,
  icon,
  marker,
  tone,
}: {
  label: string
  value: string
  caption: string
  icon?: ReactNode
  /** Cor da série no gráfico (liga o número à barra de mesma cor) */
  marker?: string
  /** Resultado: verde se positivo, vermelho se negativo (com ícone e selo, não só cor) */
  tone?: 'good' | 'bad'
}) {
  const style = tone ? toneStyles[tone] : neutralStyle
  return (
    <section className={`rounded-2xl p-5 shadow-sm ring-1 ${style.card}`}>
      <h2 className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        {icon && (
          <span
            aria-hidden="true"
            className={`grid size-6 place-items-center rounded-full text-white ${marker ?? style.icon}`}
          >
            {icon}
          </span>
        )}
        {label}
      </h2>
      <p className={`mt-3 text-2xl font-bold tracking-tight 2xl:text-3xl ${style.value}`}>
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        {tone && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              tone === 'good' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
            }`}
          >
            {tone === 'good' ? 'Positivo' : 'Negativo'}
          </span>
        )}
        {caption}
      </p>
    </section>
  )
}

const categoryLabels = {
  entrada: {
    deposito: 'Depósitos',
    transferencia: 'Transferências recebidas',
    estorno: 'Estornos recebidos',
  },
  saida: {
    deposito: 'Depósitos',
    transferencia: 'Transferências enviadas',
    estorno: 'Estornos debitados',
  },
} as const

/** Quanto cada tipo de movimentação representa nas entradas (ou nas saídas). */
function Breakdown({
  summary,
  type,
}: {
  summary: TransactionSummary
  type: 'entrada' | 'saida'
}) {
  const rows = summary.by_category.filter((c) => c.type === type)
  const total = Number(type === 'entrada' ? summary.total_entradas : summary.total_saidas)

  if (rows.length === 0 || total === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {type === 'entrada' ? 'Nada entrou' : 'Nada saiu'} neste período.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const share = Number(row.total) / total
        return (
          <li key={row.category}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {categoryLabels[type][row.category]}
                <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
                  {row.count} {row.count === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              </span>
              <span className="tabular shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(row.total)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              {/* Trilho na mesma família de cor da barra */}
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${type === 'entrada' ? 'bg-entrada' : 'bg-saida'}`}
                  style={{ width: `${Math.max(share * 100, 1)}%` }}
                />
              </div>
              <span className="tabular w-10 text-right text-xs text-slate-500 dark:text-slate-400">
                {Math.round(share * 100)}%
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
