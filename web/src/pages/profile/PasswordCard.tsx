import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../auth/context'
import { errorMessage } from '../../api/client'
import { changePassword } from '../../api/requests'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'

const schema = z
  .object({
    current_password: z.string().min(1, 'Informe a senha atual'),
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

export function PasswordCard({ userId }: { userId: string }) {
  const { logout } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    setError(null)
    try {
      await changePassword(userId, { current_password, new_password })
      // A API invalida todas as sessões ao trocar a senha: é preciso entrar de novo
      await logout('Senha alterada. Entre com a nova senha.', { skipApi: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  return (
    <Card
      title="Alterar senha"
      description="Por segurança, ao trocar a senha você sai de todos os dispositivos e precisa entrar de novo."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Senha atual" error={errors.current_password?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              {...register('current_password')}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nova senha" error={errors.new_password?.message}>
            {(a11y) => (
              <Input
                {...a11y}
                type="password"
                autoComplete="new-password"
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
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Alterar senha
          </Button>
        </div>
      </form>
    </Card>
  )
}
