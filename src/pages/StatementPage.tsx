import { useState } from 'react'
import { useTransactions } from '../api/queries'
import { errorMessage } from '../api/client'
import { TransactionList } from '../components/TransactionList'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Loading } from '../components/ui/Spinner'

const PAGE_SIZE = 20

export function StatementPage() {
  const [page, setPage] = useState(0)
  // Pede 1 a mais para saber se existe próxima página
  const query = useTransactions(PAGE_SIZE + 1, page * PAGE_SIZE)
  const items = query.data?.slice(0, PAGE_SIZE) ?? []
  const hasNext = (query.data?.length ?? 0) > PAGE_SIZE

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Extrato"
        description="Todas as entradas e saídas da sua conta, das mais recentes para as mais antigas."
      />
      <Card>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Alert tone="error">{errorMessage(query.error)}</Alert>
        ) : items.length === 0 ? (
          <EmptyState title={page === 0 ? 'Nenhuma movimentação ainda' : 'Não há mais movimentações'} />
        ) : (
          <div className={query.isPlaceholderData ? 'opacity-60 transition' : ''}>
            <TransactionList items={items} />
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
              Mais antigas
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
