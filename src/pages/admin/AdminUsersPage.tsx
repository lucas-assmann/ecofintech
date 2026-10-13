import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/context'
import type { User } from '../../api/client'
import { errorMessage } from '../../api/client'
import { queryKeys } from '../../api/queries'
import { deleteUser, listUsers } from '../../api/requests'
import { formatCpf, formatDate, formatPhone, onlyDigits } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Spinner'

export function AdminUsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: queryKeys.users, queryFn: listUsers })
  const [search, setSearch] = useState('')
  const [toRemove, setToRemove] = useState<User | null>(null)
  const [removing, setRemoving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term || !users.data) return users.data ?? []
    const digits = onlyDigits(term)
    return users.data.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.includes(term) ||
        (digits.length > 0 && u.cpf.includes(digits)),
    )
  }, [search, users.data])

  const remove = async () => {
    if (!toRemove) return
    setRemoving(true)
    try {
      await deleteUser(toRemove.id)
      setFeedback({ ok: true, text: `${toRemove.name} foi removido.` })
      await queryClient.invalidateQueries({ queryKey: queryKeys.users })
    } catch (err) {
      setFeedback({ ok: false, text: errorMessage(err) })
    } finally {
      setRemoving(false)
      setToRemove(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Todos os clientes cadastrados."
        actions={
          <div className="w-full sm:w-72">
            <Input
              type="search"
              aria-label="Buscar por nome, e-mail ou CPF"
              placeholder="Buscar por nome, e-mail ou CPF"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      {feedback && (
        <div className="mb-4">
          <Alert tone={feedback.ok ? 'success' : 'error'}>{feedback.text}</Alert>
        </div>
      )}

      <Card>
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <Alert tone="error">{errorMessage(users.error)}</Alert>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum usuário encontrado" />
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Cliente</th>
                  <th scope="col" className="px-3 py-3 font-semibold">CPF</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Telefone</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Situação</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Desde</th>
                  <th scope="col" className="px-5 py-3 sm:px-6"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 sm:px-6">
                      <p className="font-medium text-slate-900">
                        {u.name}{' '}
                        {u.role === 'admin' && <Badge tone="blue">Admin</Badge>}
                      </p>
                      <p className="text-slate-500">{u.email}</p>
                    </td>
                    <td className="tabular px-3 py-3 whitespace-nowrap">{formatCpf(u.cpf)}</td>
                    <td className="tabular px-3 py-3 whitespace-nowrap">{formatPhone(u.phone)}</td>
                    <td className="px-3 py-3">
                      {u.status === 'active' ? (
                        <Badge tone="green">Ativa</Badge>
                      ) : (
                        <Badge tone="red">Desativada</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      {u.id !== me?.id && (
                        <Button
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setFeedback(null)
                            setToRemove(u)
                          }}
                        >
                          Remover
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={toRemove !== null} onClose={() => setToRemove(null)} title="Remover usuário">
        {toRemove && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Remover <strong>{toRemove.name}</strong> ({toRemove.email})? A ação
              fica registrada na auditoria. Usuários com movimentações não podem
              ser removidos; nesse caso, use a desativação.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setToRemove(null)} disabled={removing}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={remove} loading={removing}>
                Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
