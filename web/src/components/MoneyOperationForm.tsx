import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { MoneyInput } from './ui/MoneyInput'
import { RecipientField } from './RecipientField'
import {
  moneyOperationSchema,
  type MoneyOperationValues,
} from '../lib/money-operation'
import { formatMoney } from '../lib/format'

/** Etapa 1 da transferência/depósito: preencher os dados. */
export function MoneyOperationForm({
  defaultValues,
  maxAmount,
  submitLabel,
  onSubmit,
  validateRecipient,
}: {
  defaultValues?: Partial<MoneyOperationValues>
  /** Saldo disponível (na transferência); valida o valor antes de enviar */
  maxAmount?: number
  submitLabel: string
  onSubmit: (values: MoneyOperationValues) => void
  /** Validação extra do destinatário (ex.: não pode ser você mesmo) */
  validateRecipient?: (values: MoneyOperationValues) => string | null
}) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MoneyOperationValues>({
    resolver: zodResolver(moneyOperationSchema),
    defaultValues: {
      mode: 'email',
      recipient: '',
      amount: undefined,
      description: '',
      ...defaultValues,
    },
  })
  const mode = useWatch({ control, name: 'mode' })

  const submit = handleSubmit((values) => {
    const recipientError = validateRecipient?.(values)
    if (recipientError) {
      setError('recipient', { message: recipientError })
      return
    }
    if (maxAmount !== undefined && values.amount > maxAmount) {
      setError('amount', {
        message: `Saldo insuficiente. Disponível: ${formatMoney(maxAmount)}`,
      })
      return
    }
    onSubmit(values)
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Para quem" error={errors.recipient?.message}>
        {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
          <Controller
            control={control}
            name="mode"
            render={({ field: modeField }) => (
              <Controller
                control={control}
                name="recipient"
                render={({ field }) => (
                  <RecipientField
                    id={id}
                    invalid={invalid}
                    describedBy={describedBy}
                    mode={modeField.value}
                    onModeChange={modeField.onChange}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          />
        )}
      </Field>

      <Field
        label="Valor"
        error={errors.amount?.message}
        hint={
          maxAmount !== undefined
            ? `Disponível: ${formatMoney(maxAmount)}`
            : undefined
        }
      >
        {(a11y) => (
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                {...a11y}
                value={field.value ?? null}
                onChange={(value) => field.onChange(value ?? undefined)}
              />
            )}
          />
        )}
      </Field>

      <Field label="Descrição (opcional)" error={errors.description?.message}>
        {(a11y) => (
          <Input
            {...a11y}
            maxLength={140}
            placeholder={mode === 'email' ? 'Ex.: Aluguel' : 'Ex.: Pagamento'}
            {...register('description')}
          />
        )}
      </Field>

      <Button type="submit" full>
        {submitLabel}
      </Button>
    </form>
  )
}
