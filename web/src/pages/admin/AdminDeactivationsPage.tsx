import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DeactivationRequest, Schemas } from '../../api/client'
import { errorMessage } from '../../api/client'
import { queryKeys } from '../../api/queries'
import {
  approveDeactivation,
  listDeactivations,
  rejectDeactivation,
} from '../../api/requests'
import { formatDateTime } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Field, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Spinner'

type Status = Schemas['deactivation_request_status']

const tabs: { status: Status; label: string }[] = [
  { status: 'pending', label: 'Pendentes' },
  { status: 'approved', label: 'Aprovadas' },
  { status: 'rejected', label: 'Recusadas' },
]

export function AdminDeactivationsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('pending')
  const requests = useQuery({
    queryKey: queryKeys.deactivations(status),
    queryFn: () => listDeactivations(status),
  })
  const [review, setReview] = useState<{
    request: DeactivationRequest
    action: 'approve' | 'reject'
  } | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const submit = async () => {
    if (!review) return
    setSending(true)
    setError(null)
    try {
      const fn = review.action === 'approve' ? approveDeactivation : rejectDeactivation
      await fn(review.request.id, note.trim() || undefined)
      setFeedback(
        review.action === 'approve'
          ? `Conta de ${review.request.user.name} desativada.`
          : `Solicitação de ${review.request.user.name} recusada.`,
      )
      setReview(null)
      setNote('')
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    } catch (err) {
      // Ex.: "A conta ainda tem saldo de R$ ..." ou "já foi avaliada"
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Solicitações de desativação"
        description="Aprovar desativa a conta (exige saldo zerado). Recusar mantém a conta ativa."
      />

      <div role="tablist" aria-label="Situação" className="mb-4 inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            role="tab"
            type="button"
            aria-selected={status === tab.status}
            onClick={() => {
              setStatus(tab.status)
              setFeedback(null)
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
              status === tab.status ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="mb-4">
          <Alert tone="success">{feedback}</Alert>
        </div>
      )}

      {requests.isPending ? (
        <Loading />
      ) : requests.isError ? (
        <Alert tone="error">{errorMessage(requests.error)}</Alert>
      ) : requests.data.length === 0 ? (
        <EmptyState title="Nenhuma solicitação aqui" />
      ) : (
        <ul className="space-y-3">
          {requests.data.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{r.user.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{r.user.email}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Solicitado em {formatDateTime(r.requested_at)}
                    </p>
                    {r.reason && (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">Motivo:</span> {r.reason}
                      </p>
                    )}
                    {r.reviewed_at && (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Avaliado em {formatDateTime(r.reviewed_at)}
                        {r.review_note ? ` · ${r.review_note}` : ''}
                      </p>
                    )}
                  </div>
                  {r.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => { setError(null); setReview({ request: r, action: 'reject' }) }}>
                        Recusar
                      </Button>
                      <Button variant="danger" onClick={() => { setError(null); setReview({ request: r, action: 'approve' }) }}>
                        Aprovar
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={r.status === 'approved' ? 'green' : 'red'}>
                      {r.status === 'approved' ? 'Aprovada' : 'Recusada'}
                    </Badge>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={review !== null}
        onClose={() => setReview(null)}
        title={review?.action === 'approve' ? 'Aprovar e desativar a conta' : 'Recusar solicitação'}
      >
        {review && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {review.action === 'approve'
                ? `A conta de ${review.request.user.name} será desativada: as sessões abertas caem, o login é bloqueado e ela não recebe mais transferências. O histórico é mantido.`
                : `A conta de ${review.request.user.name} continua ativa. O cliente pode solicitar de novo depois.`}
            </p>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Observação para o cliente (opcional)">
              {(a11y) => (
                <Textarea {...a11y} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              )}
            </Field>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setReview(null)} disabled={sending}>
                Cancelar
              </Button>
              <Button
                variant={review.action === 'approve' ? 'danger' : 'primary'}
                onClick={submit}
                loading={sending}
              >
                {review.action === 'approve' ? 'Aprovar e desativar' : 'Recusar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
