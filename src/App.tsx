import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, RequireAdmin, RequireAuth } from './auth/guards'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { TransferPage } from './pages/TransferPage'
import { StatementPage } from './pages/StatementPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminDepositPage } from './pages/admin/AdminDepositPage'
import { AdminDeactivationsPage } from './pages/admin/AdminDeactivationsPage'
import { AdminReversalPage } from './pages/admin/AdminReversalPage'
import { AdminTransactionsPage } from './pages/admin/AdminTransactionsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AccountsPage } from './pages/AccountsPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'

export function App() {
  return (
    <Routes>
      {/* Públicas: quem já está logado vai para o início */}
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      </Route>

      {/* Aberta pelo link do e-mail, mesmo por quem ainda está logado neste navegador */}
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      {/* Exigem login */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transferir" element={<TransferPage />} />
          <Route path="extrato" element={<StatementPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="contas" element={<AccountsPage />} />

          {/* Exigem perfil de administrador */}
          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<Navigate to="usuarios" replace />} />
            <Route path="usuarios" element={<AdminUsersPage />} />
            <Route path="deposito" element={<AdminDepositPage />} />
            <Route path="desativacoes" element={<AdminDeactivationsPage />} />
            <Route path="lancamentos" element={<AdminTransactionsPage />} />
            <Route path="estorno" element={<AdminReversalPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
