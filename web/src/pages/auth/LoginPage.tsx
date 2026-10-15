import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queries'
import { listAccounts, listInvites } from '../../api/requests'
import { useAuth } from '../../auth/context'
import { errorMessage } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login, notice } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      let destination = state?.from ?? '/'
      await login(email, password, async () => {
        // Quem tem empresa (ou convite) escolhe com qual conta vai operar.
        // Decide aqui, antes de "entrar": senão a tela de login redireciona
        // para o início e as duas navegações disputam quem chega por último.
        const [accounts, invites] = await Promise.all([
          queryClient.fetchQuery({ queryKey: queryKeys.accounts, queryFn: listAccounts }),
          queryClient.fetchQuery({ queryKey: queryKeys.invites, queryFn: listInvites }),
        ]).catch(() => [[], []])
        if (accounts.length > 1 || invites.length > 0) destination = '/contas'
      })
      navigate(destination, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  return (
    <AuthLayout
      title="Entrar"
      subtitle={
        <>
          Ainda não tem conta?{' '}
          <Link
            to="/cadastro"
            className="font-semibold text-brand-700 dark:text-brand-400 hover:underline"
          >
            Abra a sua
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {notice && !error && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="E-mail" error={errors.email?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="email"
              autoFocus
              {...register('email')}
            />
          )}
        </Field>

        <div className="space-y-2">
          <Field label="Senha" error={errors.password?.message}>
            {(a11y) => (
              <Input
                {...a11y}
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
            )}
          </Field>
          <div className="text-right">
            <Link
              to="/esqueci-senha"
              className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <Button type="submit" full loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
