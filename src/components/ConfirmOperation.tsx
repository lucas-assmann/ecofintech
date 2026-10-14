import { useState } from 'react'
import type { Transaction } from '../api/client'
import { errorMessage, isNetworkError } from '../api/client'
import { formatCnpj, formatCpf, formatDateTime, formatMoney } from '../lib/format'
import {
  newIdempotencyKey,
  type MoneyOperationValues,
} from '../lib/money-operation'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { CheckIcon } from './icons'

function Summary({ values, from }: { values: MoneyOperationValues; from?: string }) {
  return (
    <dl className="space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm">
      {from && (
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">De</dt>
          <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">{from}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-slate-500 dark:text-slate-400">Para</dt>
        <dd className="text-right font-medium break-all">
          {values.mode === 'cpf'
            ? `CPF ${formatCpf(values.recipient)}`
            : values.mode === 'cnpj'
              ? `CNPJ ${formatCnpj(values.recipient)}`
              : values.recipient}
        </dd>
      </div>
      {values.description && (
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Descrição</dt>
          <dd className="text-right font-medium">{values.description}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-3">
        <dt className="text-slate-500 dark:text-slate-400">Valor</dt>
        <dd className="tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
          {formatMoney(values.amount)}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Etapa 2: confirmar. A chave de idempotência é criada uma vez por confirmação
 * e reaproveitada se for preciso tentar de novo (ex.: a conexão caiu e não
 * sabemos se a API recebeu). Assim a operação nunca acontece duas vezes.
 */
export function ConfirmOperation({
  values,
  from,
  confirmLabel,
  execute,
  onBack,
  onDone,
}: {
  values: MoneyOperationValues
  /** Nome da conta de onde o dinheiro sai (transferência; o depósito vem de fora) */
  from?: string
  confirmLabel: string
  execute: (idempotencyKey: string) => Promise<Transaction>
  onBack: () => void
  onDone: (result: Transaction) => void
}) {
  // Gerada uma única vez por confirmação (inicialização preguiçosa do useState)
  const [key] = useState(newIdempotencyKey)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(
    null,
  )

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      onDone(await execute(key))
    } catch (err) {
      setError({ message: errorMessage(err), retry: isNetworkError(err) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <Summary values={values} from={from} />

      {error && (
        <Alert tone="error" title={error.retry ? 'Não foi possível confirmar' : undefined}>
          {error.message}
          {error.retry && (
            <p className="mt-1">
              Tentar de novo é seguro: a operação não será feita duas vezes.
            </p>
          )}
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={onBack} disabled={submitting} full>
          Voltar e editar
        </Button>
        <Button onClick={confirm} loading={submitting} full>
          {error?.retry ? 'Tentar novamente' : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/** Etapa 3: comprovante. */
export function OperationReceipt({
  title,
  result,
  values,
  onNew,
  newLabel,
}: {
  title: string
  result: Transaction
  values: MoneyOperationValues
  onNew: () => void
  newLabel: string
}) {
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-400">
        <CheckIcon className="size-7" />
      </span>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="tabular mt-2 text-3xl font-bold">{formatMoney(result.amount)}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatDateTime(result.created_at)}</p>
      </div>
      <div className="text-left">
        <Summary values={values} />
      </div>
      <p className="text-xs break-all text-slate-500 dark:text-slate-400">
        Código da movimentação: <span className="font-mono">{result.id}</span>
      </p>
      <Button onClick={onNew} variant="secondary" full>
        {newLabel}
      </Button>
    </div>
  )
}
