import { useEffect, useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { CompanyMembers } from '../../api/client'
import { ApiError, errorMessage } from '../../api/client'
import { queryKeys, useMembers } from '../../api/queries'
import {
  cancelInvite,
  inviteToCompany,
  leaveCompany,
  removeMember,
} from '../../api/requests'
import { useActiveAccount } from '../../auth/account-context'
import { useAuth } from '../../auth/context'
import { isValidCpf } from '../../lib/cpf'
import { formatCnpj, formatDate, onlyDigits } from '../../lib/format'
import { RecipientField, type RecipientMode } from '../../components/RecipientField'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Spinner'

type Member = CompanyMembers['members'][number]

/** Membros e convites da empresa ativa. O dono gerencia; membros só veem e podem sair. */
export function CompanyPage() {
  const { active, accounts, loading, switchTo } = useActiveAccount()
  const { user } = useAuth()
  const members = useMembers(active?.kind === 'company' ? active.company_id : null)
  const queryClient = useQueryClient()

  // 403 aqui = a pessoa saiu ou foi removida da empresa: recarregar a lista de
  // contas faz o AccountProvider voltar para a conta pessoal, com aviso
  const removed = members.error instanceof ApiError && members.error.status === 403
  useEffect(() => {
    if (removed) void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
  }, [removed, queryClient])

  // Ao recarregar a página, a lista de contas ainda está chegando: não dá
  // para saber se a conta ativa é uma empresa antes disso
  if (loading) return <Loading label="Carregando a empresa..." />
  if (active?.kind !== 'company' || !active.company_id) return <Navigate to="/" replace />
  const companyId = active.company_id
  const isOwner = active.role === 'owner'

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={active.name}
        description={`CNPJ ${formatCnpj(active.document)} · você é ${isOwner ? 'o dono' : 'membro'} desta empresa`}
      />

      {members.isPending ? (
        <Loading />
      ) : members.isError ? (
        <Alert tone="error">{errorMessage(members.error)}</Alert>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <MembersCard
            companyId={companyId}
            data={members.data}
            isOwner={isOwner}
            myId={user?.id}
          />
          <div className="space-y-6">
            {isOwner ? (
              <InviteCard companyId={companyId} pending={members.data.invites} />
            ) : (
              <LeaveCard
                companyId={companyId}
                name={active.name}
                onLeft={() => switchTo(accounts[0].id)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MembersCard({
  companyId,
  data,
  isOwner,
  myId,
}: {
  companyId: string
  data: CompanyMembers
  isOwner: boolean
  myId?: string
}) {
  const queryClient = useQueryClient()
  const [toRemove, setToRemove] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    if (!toRemove) return
    setRemoving(true)
    setError(null)
    try {
      await removeMember(companyId, toRemove.user_id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) })
      setToRemove(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card title="Membros" description="Todos os membros podem ver o saldo e transferir pela conta da empresa.">
      <ul className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
        {data.members.map((member) => (
          <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                {member.name}
                {member.user_id === myId && (
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(você)</span>
                )}
                <Badge tone={member.role === 'owner' ? 'blue' : 'neutral'}>
                  {member.role === 'owner' ? 'Dono' : 'Membro'}
                </Badge>
              </p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {member.email} · desde {formatDate(member.created_at)}
              </p>
            </div>
            {isOwner && member.role !== 'owner' && (
              <Button variant="danger-ghost" onClick={() => setToRemove(member)}>
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Modal open={toRemove !== null} onClose={() => setToRemove(null)} title="Remover membro">
        {toRemove && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-100">{toRemove.name}</strong> perde o
              acesso à conta da empresa na hora. As movimentações que fez continuam no extrato.
            </p>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setToRemove(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={remove} loading={removing}>
                Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function InviteCard({
  companyId,
  pending,
}: {
  companyId: string
  pending: CompanyMembers['invites']
}) {
  const queryClient = useQueryClient()
  const id = useId()
  const [mode, setMode] = useState<RecipientMode>('email')
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    const valid = mode === 'email' ? z.email().safeParse(value.trim()).success : isValidCpf(value)
    if (!valid) {
      setInvalid(mode === 'email' ? 'Informe um e-mail válido' : 'CPF inválido')
      return
    }
    setInvalid(null)
    setSending(true)
    try {
      await inviteToCompany(
        companyId,
        mode === 'email' ? { email: value.trim().toLowerCase() } : { cpf: onlyDigits(value) },
      )
      setValue('')
      setFeedback({ ok: true, text: 'Convite enviado. A pessoa vê o convite quando entrar no app.' })
      await refresh()
    } catch (err) {
      // Ex.: "Usuário não encontrado", "Esta pessoa já faz parte da empresa"
      setFeedback({ ok: false, text: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  const cancel = async (inviteId: string) => {
    setFeedback(null)
    try {
      await cancelInvite(companyId, inviteId)
      await refresh()
    } catch (err) {
      setFeedback({ ok: false, text: errorMessage(err) })
    }
  }

  return (
    <Card title="Convidar pessoa" description="A pessoa precisa já ter conta no Ecofintech.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Quem você quer convidar
          </label>
          <RecipientField
            id={id}
            mode={mode}
            onModeChange={(next) => {
              setMode(next)
              setInvalid(null)
            }}
            value={value}
            onChange={setValue}
            invalid={invalid !== null}
            describedBy={invalid ? `${id}-error` : undefined}
            modes={['email', 'cpf']}
          />
          {invalid && (
            <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400">
              {invalid}
            </p>
          )}
        </div>
        {feedback && <Alert tone={feedback.ok ? 'success' : 'error'}>{feedback.text}</Alert>}
        <Button type="submit" loading={sending} full>
          Enviar convite
        </Button>
      </form>

      {pending.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Convites pendentes
          </h3>
          <ul className="space-y-2">
            {pending.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {invite.invited_user.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {invite.invited_user.email}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => cancel(invite.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function LeaveCard({
  companyId,
  name,
  onLeft,
}: {
  companyId: string
  name: string
  onLeft: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leave = async () => {
    setLeaving(true)
    setError(null)
    try {
      await leaveCompany(companyId)
      onLeft()
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setLeaving(false)
    }
  }

  return (
    <Card title="Sair da empresa" description="Você deixa de ver e de movimentar a conta da empresa.">
      <Button variant="danger" full onClick={() => setOpen(true)}>
        Sair da empresa
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sair da empresa">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Você perde o acesso à conta de <strong className="text-slate-900 dark:text-slate-100">{name}</strong>.
            Para voltar, o dono precisa te convidar de novo.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={leave} loading={leaving}>
              Sair
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
