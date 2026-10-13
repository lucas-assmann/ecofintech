import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import * as requests from '../api/requests'
import {
  clearToken,
  getToken,
  SESSION_EXPIRED_EVENT,
  setToken,
} from './session'
import {
  AuthContext,
  SESSION_EXPIRED_MESSAGE,
  type AuthContextValue,
} from './context'


export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [token, setTokenState] = useState(getToken)
  const [notice, setNotice] = useState<string | null>(null)

  const me = useQuery({
    queryKey: ['me'],
    queryFn: requests.getMe,
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  // Limpa tudo o que foi carregado e volta para o login
  const endSession = useCallback(
    (message?: string) => {
      setNotice(message ?? null)
      clearToken()
      setTokenState(null)
      queryClient.clear()
      navigate('/login', { replace: true })
    },
    [navigate, queryClient],
  )

  // A API respondeu 401 em alguma requisição: a sessão não vale mais
  useEffect(() => {
    const onExpired = () => endSession(SESSION_EXPIRED_MESSAGE)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [endSession])

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await requests.login({ email, password })
      setToken(access_token)
      queryClient.clear()
      setNotice(null)
      setTokenState(access_token)
    },
    [queryClient],
  )

  const logout = useCallback(
    async (message?: string, options?: { skipApi?: boolean }) => {
      // Invalida o token na API; se falhar (ex.: já expirado), sai do mesmo jeito
      if (!options?.skipApi) await requests.logout().catch(() => undefined)
      endSession(message)
    },
    [endSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (me.data ?? null) : null,
      loading: Boolean(token) && me.isPending,
      isAdmin: me.data?.role === 'admin',
      login,
      logout,
      notice,
    }),
    [token, me.data, me.isPending, login, logout, notice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
