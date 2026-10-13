import { useState, type FormEvent } from 'react'
import type { Transaction } from '../../api/client'
import { errorMessage } from '../../api/client'
import { getTransaction, reverseTransaction } from '../../api/requests'
import { formatDateTime, formatMoney } from '../../lib/format'
import { describeTransaction } from '../../lib/transactions'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function AdminReversalPage() {
  const [id, setId] = useState('')
  const [found, setFound] = useState<Transaction | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Transaction[] | null>(null)

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setFound(null)
    setResult(null)
    if (!UUID.test(id.trim())) {
      setError('Informe o código da movimentação (formato UUID).')
      return
    }
    setLoading(true)
    try {
      setFound(await getTransaction(id.trim()))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const reverse = async () => {
    if (!found) return
    setLoading(true)
    setError(null)
    try {
      setResult(await reverseTransaction(found.id, { reason: reason.trim() || undefined }))
      setFound(null)
      setReason('')
      setId('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Estorno"
        description="Desfaz uma movimentação com um lançamento inverso. Em transferências, as duas pontas são estornadas."
      />

      <Card title="Buscar movimentação">
        <form onSubmit={search} noValidate className="space-y-4">
          <Field
            label="Código da movimentação"
            hint="O cliente encontra o código nos detalhes do lançamento, no extrato."
          >
            {(a11y) => (
              <Input
                {...a11y}
                className="font-mono text-sm"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" loading={loading && !found} full>
            Buscar
          </Button>
        </form>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}

      {result && (
        <Alert tone="success" title="Estorno realizado">
          <ul className="mt-1 space-y-1">
            {result.map((t) => (
              <li key={t.id}>
                {describeTransaction(t)}: {t.type === 'entrada' ? '+' : '−'} {formatMoney(t.amount)}
                {t.counterparty ? ` (${t.counterparty.name})` : ''}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {found && (
        <Card title="Confirmar estorno">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Movimentação</dt>
              <dd className="text-right font-medium">
                {describeTransaction(found)}{' '}
                {found.category === 'estorno' && <Badge tone="amber">Estorno</Badge>}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Valor</dt>
              <dd className="tabular font-semibold">{formatMoney(found.amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Data</dt>
              <dd>{formatDateTime(found.created_at)}</dd>
            </div>
            {found.counterparty && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Contraparte</dt>
                <dd className="text-right">{found.counterparty.name}</dd>
              </div>
            )}
          </dl>

          {found.category === 'estorno' ? (
            <div className="mt-4">
              <Alert tone="warning">Esta movimentação já é um estorno e não pode ser estornada.</Alert>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <Field label="Motivo (aparece no extrato do cliente)">
                {(a11y) => (
                  <Input
                    {...a11y}
                    maxLength={140}
                    placeholder="Ex.: Transferência contestada"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
              </Field>
              <Button variant="danger" onClick={reverse} loading={loading} full>
                Estornar {formatMoney(found.amount)}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
