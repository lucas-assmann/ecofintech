import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '../../api/client'
import { errorMessage } from '../../api/client'
import { updateUser } from '../../api/requests'
import { formatCpf, formatPhone, onlyDigits } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'

const today = new Date().toISOString().slice(0, 10)

const schema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo').max(120),
  email: z.email('Informe um e-mail válido'),
  phone: z
    .string()
    .refine((v) => /^\d{10,11}$/.test(onlyDigits(v)), 'Informe DDD + número'),
  date_of_birth: z
    .string()
    .min(1, 'Informe a data')
    .refine((v) => v < today, 'Data inválida'),
})
type FormValues = z.infer<typeof schema>

export function PersonalDataCard({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: formatPhone(user.phone),
      date_of_birth: user.date_of_birth,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null)
    try {
      const updated = await updateUser(user.id, {
        ...values,
        phone: onlyDigits(values.phone),
      })
      queryClient.setQueryData(['me'], updated)
      reset({ ...values, phone: formatPhone(updated.phone) })
      setFeedback({ ok: true, text: 'Dados atualizados.' })
    } catch (err) {
      setFeedback({ ok: false, text: errorMessage(err) })
    }
  })

  return (
    <Card title="Dados pessoais">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {feedback && (
          <Alert tone={feedback.ok ? 'success' : 'error'}>{feedback.text}</Alert>
        )}

        <Field label="Nome completo" error={errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register('name')} />}
        </Field>

        <Field label="E-mail" error={errors.email?.message}>
          {(a11y) => (
            <Input {...a11y} type="email" autoComplete="email" {...register('email')} />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="CPF" hint="O CPF não pode ser alterado.">
            {(a11y) => <Input {...a11y} value={formatCpf(user.cpf)} disabled readOnly />}
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
            <Input {...a11y} type="date" max={today} {...register('date_of_birth')} />
          )}
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </Card>
  )
}
