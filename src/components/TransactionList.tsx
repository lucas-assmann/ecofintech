import { useState, type ReactNode } from 'react'
import type { AdminTransaction, Transaction } from '../api/client'
import { formatDateTime, formatMoney } from '../lib/format'
import { describeTransaction, isIncoming, ownerOf } from '../lib/transactions'
import { ArrowDownIcon, ArrowUpIcon, UndoIcon } from './icons'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'

function TransactionIcon({ t }: { t: Transaction }) {
  const Icon =
    t.category === 'estorno' ? UndoIcon : isIncoming(t) ? ArrowDownIcon : ArrowUpIcon
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full ${
        isIncoming(t) ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
      }`}
    >
      <Icon />
    </span>
  )
}

function Amount({ t, className = '' }: { t: Transaction; className?: string }) {
  return (
    <span
      className={`tabular font-semibold ${isIncoming(t) ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-slate-100'} ${className}`}
    >
      {isIncoming(t) ? '+ ' : '− '}
      {formatMoney(t.amount)}
    </span>
  )
}

type Item = Transaction | AdminTransaction

interface TransactionListProps {
  items: Item[]
  /** Botão extra nos detalhes (ex.: estornar, na tela do admin) */
  action?: (t: Item) => ReactNode
}

/**
 * Lista do extrato; clicar num lançamento abre os detalhes.
 * Lançamentos da listagem do admin mostram também o dono da conta.
 */
export function TransactionList({ items, action }: TransactionListProps) {
  const [selected, setSelected] = useState<Item | null>(null)

  return (
    <>
      <ul className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setSelected(t)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <TransactionIcon t={t} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                  {describeTransaction(t)}
                </span>
                <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
                  {ownerOf(t) && (
                    <span className="font-medium text-slate-700 dark:text-slate-300">{ownerOf(t)?.name} · </span>
                  )}
                  {formatDateTime(t.created_at)}
                  {t.description ? ` · ${t.description}` : ''}
                  {t.operator ? ` · feita por ${t.operator.name}` : ''}
                </span>
              </span>
              <Amount t={t} className="shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Detalhes da movimentação"
      >
        {selected && (
          <>
            <TransactionDetails t={selected} />
            {action && <div className="mt-5">{action(selected)}</div>}
          </>
        )}
      </Modal>
    </>
  )
}

/** "Fulano (fulano@email.com)" para pessoas; "Padaria (empresa)" para empresas */
const partyLabel = (party: Transaction['counterparty'] & object) =>
  party.kind === 'company' ? `${party.name} (empresa)` : `${party.name} (${party.email})`

function TransactionDetails({ t }: { t: Item }) {
  const owner = ownerOf(t)
  const rows: [string, ReactNode][] = [
    ...(owner ? [['Conta de', partyLabel(owner)] as [string, ReactNode]] : []),
    ['Tipo', describeTransaction(t)],
    ['Data', formatDateTime(t.created_at)],
    ['Saldo após', <span key="saldo" className="tabular">{formatMoney(t.balance_after)}</span>],
  ]
  if (t.counterparty) {
    rows.push([
      isIncoming(t) ? 'De' : 'Para',
      partyLabel(t.counterparty),
    ])
  }
  if (t.operator) rows.push(['Feita por', t.operator.name])
  if (t.description) rows.push(['Descrição', t.description])
  if (t.reversal_of) rows.push(['Estorno do lançamento', <code key="estorno" className="text-xs break-all">{t.reversal_of}</code>])

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <TransactionIcon t={t} />
        <Amount t={t} className="text-2xl" />
        {t.category === 'estorno' && <Badge tone="amber">Estorno</Badge>}
      </div>
      <dl className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{value}</dd>
          </div>
        ))}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <dt className="text-slate-500 dark:text-slate-400">Código da movimentação</dt>
          <dd className="mt-1 font-mono text-xs break-all text-slate-700 dark:text-slate-300">{t.id}</dd>
          <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Informe este código ao suporte se precisar contestar a movimentação.
          </dd>
        </div>
      </dl>
    </div>
  )
}
