import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/context'
import { useAccount, useMyDeactivation, useTransactions } from '../api/queries'
import { errorMessage } from '../api/client'
import { firstName, formatMoney } from '../lib/format'
import { TransactionList } from '../components/TransactionList'
import { Alert } from '../components/ui/Alert'
import { Card, EmptyState } from '../components/ui/Card'
import { Loading } from '../components/ui/Spinner'
import { EyeIcon, EyeOffIcon, ListIcon, SendIcon, UserIcon } from '../components/icons'

// Preferência de mostrar/ocultar o saldo (só conveniência deste navegador)
const HIDE_KEY = 'ecofintech.hideBalance'
const readHidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function DashboardPage() {
  const { user } = useAuth()
  const account = useAccount()
  const recent = useTransactions(5)
  const deactivation = useMyDeactivation()
  const [hidden, setHidden] = useState(readHidden)

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
      <h1 className="text-2xl font-bold tracking-tight">
        Olá, {firstName(user?.name ?? '')}
      </h1>

      {deactivation.data?.status === 'pending' && (
        <Alert tone="warning" title="Solicitação de encerramento em análise">
          O suporte avaliará a solicitação. Acompanhe em{' '}
          <Link to="/perfil" className="font-semibold underline">
            Perfil
          </Link>
          .
        </Alert>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-6 text-white shadow-lg sm:p-8">
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
          <p className="tabular mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {account.isPending
              ? '...'
              : account.isError
                ? '—'
                : hidden
                  ? 'R$ ••••••'
                  : formatMoney(account.data.balance)}
          </p>
          {account.isError && (
            <p className="mt-2 text-sm text-brand-100">
              {errorMessage(account.error)}
            </p>
          )}

          <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
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

      <Card
        title="Últimas movimentações"
        actions={
          <Link to="/extrato" className="text-sm font-semibold text-brand-700 hover:underline">
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
  )
}
