import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Schemas } from '../../api/client'
import { errorMessage } from '../../api/client'
import { useAdminTransactions } from '../../api/queries'
import type { AdminTransactionFilters } from '../../api/requests'
import { TransactionList } from '../../components/TransactionList'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Field, Input, inputClass } from '../../components/ui/Field'
import { Loading } from '../../components/ui/Spinner'

const PAGE_SIZE = 20

const categories: { value: Schemas['transaction_category']; label: string }[] = [
  { value: 'deposito', label: 'Depósito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'estorno', label: 'Estorno' },
]

const types: { value: Schemas['transaction_type']; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]

const emptyFilters: AdminTransactionFilters = {}

/** Tira os campos vazios, para não mandar "?search=" na URL da API. */
function clean(filters: AdminTransactionFilters): AdminTransactionFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  )
}

export function AdminTransactionsPage() {
  const navigate = useNavigate()
  // "draft" é o que está no formulário; "filters" só muda ao clicar em Filtrar.
  // Assim a API não é chamada a cada letra digitada na busca.
  const [draft, setDraft] = useState<AdminTransactionFilters>(emptyFilters)
  const [filters, setFilters] = useState<AdminTransactionFilters>(emptyFilters)
  const [page, setPage] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  // Pede 1 a mais para saber se existe próxima página
  const query = useAdminTransactions(filters, PAGE_SIZE + 1, page * PAGE_SIZE)
  const items = query.data?.slice(0, PAGE_SIZE) ?? []
  const hasNext = (query.data?.length ?? 0) > PAGE_SIZE
  const filtering = Object.keys(filters).length > 0

  const set = (field: keyof AdminTransactionFilters) => (value: string) =>
    setDraft((d) => ({ ...d, [field]: value || undefined }))

  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      setFormError('A data inicial não pode ser depois da final.')
      return
    }
    setFormError(null)
    setFilters(clean({ ...draft, search: draft.search?.trim() }))
    setPage(0)
  }

  const reset = () => {
    setDraft(emptyFilters)
    setFilters(emptyFilters)
    setFormError(null)
    setPage(0)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Lançamentos"
        description="Todas as movimentações do sistema, das mais recentes para as mais antigas. Uma transferência aparece duas vezes: a saída de quem enviou e a entrada de quem recebeu."
      />

      <Card>
        <form onSubmit={apply} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Cliente" hint="Parte do nome, do e-mail ou do CPF do dono da conta.">
              {(a11y) => (
                <Input
                  {...a11y}
                  type="search"
                  maxLength={100}
                  placeholder="Ex.: maria ou 529.982"
                  value={draft.search ?? ''}
                  onChange={(e) => set('search')(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label="Categoria">
            {(a11y) => (
              <select
                {...a11y}
                className={inputClass}
                value={draft.category ?? ''}
                onChange={(e) => set('category')(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Tipo">
            {(a11y) => (
              <select
                {...a11y}
                className={inputClass}
                value={draft.type ?? ''}
                onChange={(e) => set('type')(e.target.value)}
              >
                <option value="">Entradas e saídas</option>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="De">
            {(a11y) => (
              <Input
                {...a11y}
                type="date"
                value={draft.from ?? ''}
                onChange={(e) => set('from')(e.target.value)}
              />
            )}
          </Field>
          <Field label="Até">
            {(a11y) => (
              <Input
                {...a11y}
                type="date"
                value={draft.to ?? ''}
                onChange={(e) => set('to')(e.target.value)}
              />
            )}
          </Field>

          {formError && (
            <div className="sm:col-span-2">
              <Alert tone="error">{formError}</Alert>
            </div>
          )}

          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">Filtrar</Button>
            {filtering && (
              <Button type="button" variant="secondary" onClick={reset}>
                Limpar filtros
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Alert tone="error">{errorMessage(query.error)}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={
              page > 0
                ? 'Não há mais lançamentos'
                : filtering
                  ? 'Nenhum lançamento com esses filtros'
                  : 'Nenhum lançamento ainda'
            }
          />
        ) : (
          <div className={query.isPlaceholderData ? 'opacity-60 transition' : ''}>
            <TransactionList
              items={items}
              action={(t) =>
                t.category === 'estorno' ? null : (
                  <Button
                    variant="danger"
                    full
                    onClick={() => navigate('/admin/estorno', { state: { transaction: t } })}
                  >
                    Estornar esta movimentação
                  </Button>
                )
              }
            />
          </div>
        )}

        {(page > 0 || hasNext) && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || query.isFetching}
            >
              Anteriores
            </Button>
            <span className="text-sm text-slate-500">Página {page + 1}</span>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || query.isFetching}
            >
              Mais antigos
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
