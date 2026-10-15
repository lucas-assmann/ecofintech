import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OperableAccount, User } from '../api/client'
import * as requests from '../api/requests'
import { AuthContext, type AuthContextValue } from './context'
import { AccountProvider } from './AccountProvider'
import { useActiveAccount } from './account-context'
import { getActiveAccountId, setActiveAccountId } from './account'

const personal = {
  id: 'acc-pessoal',
  kind: 'personal',
  name: 'Maria',
  document: '52998224725',
  balance: '10.00',
  role: null,
  company_id: null,
} as OperableAccount
const company = {
  id: 'acc-empresa',
  kind: 'company',
  name: 'Padaria Pão Bom',
  document: '11222333000181',
  balance: '500.00',
  role: 'member',
  company_id: 'company-1',
} as OperableAccount

function Probe() {
  const { active, switchTo, revokedNotice } = useActiveAccount()
  return (
    <div>
      <p data-testid="active">{active?.kind ?? 'nenhuma'}</p>
      <p data-testid="notice">{revokedNotice ?? ''}</p>
      <button type="button" onClick={() => switchTo(company.id)}>
        empresa
      </button>
    </div>
  )
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = (user: User | null) =>
    ({ user, loading: false, isAdmin: false, login: vi.fn(), logout: vi.fn(), notice: null }) as AuthContextValue
  const tree = (user: User | null) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth(user)}>
        <AccountProvider>
          <Probe />
        </AccountProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  const maria = { id: 'user-1', name: 'Maria' } as User
  const view = render(tree(maria))
  return { queryClient, maria, rerender: (user: User | null) => view.rerender(tree(user)) }
}

describe('AccountProvider', () => {
  afterEach(() => vi.restoreAllMocks())

  it('depois de sair e entrar de novo, tela e cabeçalho voltam juntos para a conta pessoal', async () => {
    vi.spyOn(requests, 'listAccounts').mockResolvedValue([personal, company])
    const { maria, rerender } = setup()
    await screen.findByText('personal')

    await userEvent.click(screen.getByRole('button', { name: 'empresa' }))
    expect(screen.getByTestId('active')).toHaveTextContent('company')

    // Logout (ou sessão expirada): o AuthProvider limpa a conta guardada
    setActiveAccountId(null)
    rerender(null)
    rerender(maria)

    // O cabeçalho não vai mais (pessoal) — a tela tem que dizer o mesmo
    expect(getActiveAccountId()).toBeNull()
    expect(await screen.findByText('personal')).toBeInTheDocument()
  })

  it('se a empresa ativa some da lista de contas (foi removido), volta para a pessoal com aviso', async () => {
    const list = vi.spyOn(requests, 'listAccounts').mockResolvedValue([personal, company])
    const { queryClient } = setup()
    await screen.findByText('personal')
    await userEvent.click(screen.getByRole('button', { name: 'empresa' }))
    expect(getActiveAccountId()).toBe(company.id)

    list.mockResolvedValue([personal])
    await act(() => queryClient.invalidateQueries({ queryKey: ['accounts'] }))

    expect(await screen.findByText('personal')).toBeInTheDocument()
    expect(getActiveAccountId()).toBeNull()
    expect(screen.getByTestId('notice')).toHaveTextContent('não tem mais acesso')
  })
})
