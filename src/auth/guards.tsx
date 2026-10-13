import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './context'
import { Loading } from '../components/ui/Spinner'

/** Só deixa passar quem está logado; senão, vai para o login. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading label="Abrindo sua conta..." />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Só para administradores; os demais voltam para o início. */
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

/** Telas de login e cadastro: quem já está logado vai direto para o início. */
export function GuestOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Navigate to="/" replace /> : <Outlet />
}
