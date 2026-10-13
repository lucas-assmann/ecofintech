import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { forgotPassword } from '../../api/requests'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
})
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    try {
      await forgotPassword({ email })
      setSentTo(email)
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  const backToLogin = (
    <Link
      to="/login"
      className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
    >
      Voltar para o login
    </Link>
  )

  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail" subtitle={backToLogin}>
        {/* A API responde igual exista ou não a conta: a mensagem também não pode afirmar */}
        <Alert tone="success" title="Pedido recebido">
          Se <strong>{sentTo}</strong> estiver cadastrado, você vai receber um link para
          criar uma nova senha. Ele vale por 30 minutos.
        </Alert>
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          Não chegou? Veja a caixa de spam ou{' '}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
          >
            tente de novo
          </button>{' '}
          daqui a um minuto.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle={
        <>
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.{' '}
          {backToLogin}
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
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

        <Button type="submit" full loading={isSubmitting}>
          Enviar link
        </Button>
      </form>
    </AuthLayout>
  )
}
