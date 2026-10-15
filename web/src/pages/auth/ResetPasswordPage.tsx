import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/context'
import { errorMessage } from '../../api/client'
import { resetPassword } from '../../api/requests'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, 'A nova senha precisa ter pelo menos 8 caracteres')
      .max(72),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem',
  })
type FormValues = z.infer<typeof schema>

/** Aberta pelo link do e-mail: /redefinir-senha?token=... */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const askAgain = (
    <Link
      to="/esqueci-senha"
      className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
    >
      Pedir um novo link
    </Link>
  )

  if (!token) {
    return (
      <AuthLayout title="Link incompleto" subtitle={askAgain}>
        <Alert tone="error">
          Este endereço não tem o código de redefinição. Abra o link exatamente como veio
          no e-mail, ou peça um novo.
        </Alert>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async ({ new_password }) => {
    setError(null)
    try {
      await resetPassword({ token, new_password })
      // A troca derruba todas as sessões; se havia alguém logado neste navegador, sai também
      await logout('Senha redefinida. Entre com a nova senha.', { skipApi: true })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="Escolha uma senha com pelo menos 8 caracteres. Depois, você entra com ela."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && (
          <Alert tone="error">
            {error} {askAgain}
          </Alert>
        )}

        <Field label="Nova senha" error={errors.new_password?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              autoFocus
              {...register('new_password')}
            />
          )}
        </Field>

        <Field label="Confirme a nova senha" error={errors.confirm?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...register('confirm')}
            />
          )}
        </Field>

        <Button type="submit" full loading={isSubmitting}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
