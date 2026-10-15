import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Account, OperableAccount, User } from '../api/client'
import * as requests from '../api/requests'
import { useAccount } from '../api/queries'
import { AuthContext, type AuthContextValue } from './context'
import { AccountProvider } from './AccountProvider'
import { useActiveAccount } from './account-context'
import { getActiveAccountId } from './account'

const personal = { id: 'acc-pessoal', kind: 'personal', name: 'Maria' } as OperableAccount
const company = { id: 'acc-empresa', kind: 'company', name: 'Padaria' } as OperableAccount

// Como no app: a tela (dashboard) não usa o contexto da conta; quem troca é
// outro componente (o seletor no topo)
function Balance() {
  const account = useAccount()
  return <p data-testid="balance">{account.data?.balance ?? '...'}</p>
}

function Switcher() {
  const { switchTo } = useActiveAccount()
  return (
    <div>
      <button type="button" onClick={() => switchTo(company.id)}>
        empresa
      </button>
      <button type="button" onClick={() => switchTo(personal.id)}>
        pessoal
      </button>
    </div>
  )
}

describe('troca de conta', () => {
  afterEach(() => vi.restoreAllMocks())

  it('a tela aberta passa a mostrar os dados da conta escolhida', async () => {
    vi.spyOn(requests, 'listAccounts').mockResolvedValue([personal, company])
    // A API responde conforme o cabeçalho X-Account-Id
    vi.spyOn(requests, 'getMyAccount').mockImplementation(async () =>
      ({ balance: getActiveAccountId() === company.id ? '500.00' : '10.00' }) as Account,
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const auth = {
      user: { id: 'user-1' } as User,
      loading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      notice: null,
    } as AuthContextValue

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <AccountProvider>
            <Switcher />
            <Balance />
          </AccountProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await vi.waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('10.00'))

    await userEvent.click(screen.getByRole('button', { name: 'empresa' }))
    await vi.waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('500.00'))

    await userEvent.click(screen.getByRole('button', { name: 'pessoal' }))
    await vi.waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('10.00'))
  })
})
