import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/context'
import { errorMessage } from '../../api/client'
import { register as registerUser } from '../../api/requests'
import { isValidCpf } from '../../lib/cpf'
import { formatCpf, formatPhone, onlyDigits } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { AuthLayout } from './AuthLayout'

const today = new Date().toISOString().slice(0, 10)

const schema = z
  .object({
    name: z.string().trim().min(3, 'Informe seu nome completo').max(120),
    email: z.email('Informe um e-mail válido'),
    cpf: z.string().refine(isValidCpf, 'CPF inválido'),
    phone: z
      .string()
      .refine(
        (v) => /^\d{10,11}$/.test(onlyDigits(v)),
        'Informe DDD + número',
      ),
    date_of_birth: z
      .string()
      .min(1, 'Informe sua data de nascimento')
      .refine((v) => v < today, 'Data inválida'),
    password: z
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres')
      .max(72),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem',
  })
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cpf: '', phone: '' },
  })

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...data }) => {
    setError(null)
    try {
      await registerUser(data)
      // Conta criada: entra direto
      await login(data.email, data.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  return (
    <AuthLayout
      title="Abra sua conta"
      subtitle={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Nome completo" error={errors.name?.message}>
          {(a11y) => (
            <Input {...a11y} autoComplete="name" autoFocus {...register('name')} />
          )}
        </Field>

        <Field label="E-mail" error={errors.email?.message}>
          {(a11y) => (
            <Input {...a11y} type="email" autoComplete="email" {...register('email')} />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="CPF" error={errors.cpf?.message}>
            {(a11y) => (
              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <Input
                    {...a11y}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(formatCpf(e.target.value))}
                  />
                )}
              />
            )}
          </Field>

          <Field label="Celular" error={errors.phone?.message}>
            {(a11y) => (
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    {...a11y}
                    type="tel"
                    autoComplete="tel-national"
                    placeholder="(11) 98765-4321"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(formatPhone(e.target.value))}
                  />
                )}
              />
            )}
          </Field>
        </div>

        <Field label="Data de nascimento" error={errors.date_of_birth?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              max={today}
              autoComplete="bday"
              {...register('date_of_birth')}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres">
            {(a11y) => (
              <Input
                {...a11y}
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
            )}
          </Field>
          <Field label="Confirme a senha" error={errors.confirm?.message}>
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

        <Button type="submit" full loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
