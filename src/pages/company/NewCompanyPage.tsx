import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../api/client'
import { queryKeys } from '../../api/queries'
import { createCompany } from '../../api/requests'
import { useActiveAccount } from '../../auth/account-context'
import { isValidCnpj } from '../../lib/cnpj'
import { formatCnpj, onlyDigits } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Informe ${label} (pelo menos 2 caracteres)`)
    .max(120, `${label[0].toUpperCase()}${label.slice(1)} muito longo`)

const schema = z.object({
  cnpj: z.string().refine(isValidCnpj, 'CNPJ inválido'),
  legal_name: name('a razão social'),
  trade_name: name('o nome fantasia'),
})
type FormValues = z.infer<typeof schema>

export function NewCompanyPage() {
  const queryClient = useQueryClient()
  const { switchTo } = useActiveAccount()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const account = await createCompany({ ...values, cnpj: onlyDigits(values.cnpj) })
      // A nova empresa precisa estar na lista antes de virar a conta ativa
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts })
      switchTo(account.id)
      navigate('/', { replace: true })
    } catch (err) {
      // Ex.: "Este CNPJ já está cadastrado"
      setError(errorMessage(err))
    }
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Abrir conta de empresa"
        description="Você será o dono da empresa e poderá convidar outras pessoas para movimentar a conta."
      />
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="CNPJ" error={errors.cnpj?.message}>
            {(a11y) => (
              <Input
                {...a11y}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="00.000.000/0000-00"
                {...register('cnpj', {
                  onChange: (e: { target: { value: string } }) =>
                    setValue('cnpj', formatCnpj(e.target.value)),
                })}
              />
            )}
          </Field>

          <Field
            label="Razão social"
            hint="O nome oficial, como está no cartão CNPJ."
            error={errors.legal_name?.message}
          >
            {(a11y) => (
              <Input
                {...a11y}
                placeholder="Pão Bom Comércio de Alimentos LTDA"
                {...register('legal_name')}
              />
            )}
          </Field>

          <Field
            label="Nome fantasia"
            hint="É o nome que aparece para quem recebe transferências da empresa."
            error={errors.trade_name?.message}
          >
            {(a11y) => (
              <Input {...a11y} placeholder="Padaria Pão Bom" {...register('trade_name')} />
            )}
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Abrir empresa
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
