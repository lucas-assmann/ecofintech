import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../api/client'
import { queryKeys, useAccount, useMyDeactivation } from '../../api/queries'
import { requestDeactivation } from '../../api/requests'
import { formatDateTime, formatMoney } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Spinner'

/** Encerramento de conta: o usuário solicita e o suporte avalia. */
export function DeactivationCard() {
  const queryClient = useQueryClient()
  const request = useMyDeactivation()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      const response = await requestDeactivation({ reason: reason.trim() || undefined })
      // Mensagem vinda da API: "... O suporte avaliará a solicitação."
      setConfirmation(response.message)
      setOpen(false)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.myDeactivation })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const last = request.data
  const pending = last?.status === 'pending'
  const balance = Number(account.data?.balance ?? 0)

  return (
    <Card
      title="Encerrar conta"
      description="O pedido é avaliado pelo suporte. Seu histórico de movimentações é mantido."
    >
      {request.isPending ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {confirmation && <Alert tone="success">{confirmation}</Alert>}

          {pending && (
            <Alert tone="warning" title="Solicitação em análise">
              Enviada em {formatDateTime(last.requested_at)}. O suporte avaliará a
              solicitação.
            </Alert>
          )}

          {last?.status === 'rejected' && (
            <Alert tone="info" title="Sua última solicitação foi recusada">
              {last.review_note ?? 'Fale com o suporte para mais detalhes.'}
            </Alert>
          )}

          {!pending && balance > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Você ainda tem {formatMoney(balance)} na conta. Para o encerramento
              ser aprovado, transfira todo o saldo antes.
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            {last && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Situação:{' '}
                <Badge tone={pending ? 'amber' : last.status === 'rejected' ? 'red' : 'green'}>
                  {pending ? 'Em análise' : last.status === 'rejected' ? 'Recusada' : 'Aprovada'}
                </Badge>
              </span>
            )}
            <Button
              variant="danger"
              className="ml-auto"
              disabled={pending}
              onClick={() => {
                setError(null)
                setOpen(true)
              }}
            >
              Solicitar encerramento
            </Button>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Solicitar encerramento da conta">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sua solicitação será enviada ao suporte. Enquanto ela estiver em
            análise, a conta continua funcionando normalmente.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Motivo (opcional)">
            {(a11y) => (
              <Textarea
                {...a11y}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={send} loading={sending}>
              Enviar solicitação
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
