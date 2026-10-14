import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/context'
import type { Transaction } from '../api/client'
import { errorMessage } from '../api/client'
import { queryKeys, useAccount } from '../api/queries'
import { useActiveAccount } from '../auth/account-context'
import { transfer } from '../api/requests'
import { onlyDigits } from '../lib/format'
import {
  toRequestBody,
  type MoneyOperationValues,
} from '../lib/money-operation'
import { MoneyOperationForm } from '../components/MoneyOperationForm'
import { ConfirmOperation, OperationReceipt } from '../components/ConfirmOperation'
import { Alert } from '../components/ui/Alert'
import { Card, PageHeader } from '../components/ui/Card'
import { Loading } from '../components/ui/Spinner'

type Step =
  | { name: 'form'; values?: MoneyOperationValues }
  | { name: 'confirm'; values: MoneyOperationValues }
  | { name: 'done'; values: MoneyOperationValues; result: Transaction }

export function TransferPage() {
  const { user } = useAuth()
  const account = useAccount()
  const { active } = useActiveAccount()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ name: 'form' })

  const titles = {
    form: 'Para quem e quanto?',
    confirm: 'Confira antes de confirmar',
    done: '',
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Transferir"
        description="Envie dinheiro para outra conta Ecofintech pelo e-mail, CPF ou CNPJ."
      />
      <Card title={titles[step.name] || undefined}>
        {account.isPending ? (
          <Loading />
        ) : account.isError ? (
          <Alert tone="error">{errorMessage(account.error)}</Alert>
        ) : step.name === 'form' ? (
          <MoneyOperationForm
            defaultValues={step.values}
            maxAmount={Number(account.data.balance)}
            submitLabel="Continuar"
            validateRecipient={(values) => {
              // Bloqueia só a mesma conta: pela empresa, pagar a conta pessoal
              // de quem opera é permitido (e vice-versa)
              const self =
                active?.kind === 'company'
                  ? values.mode === 'cnpj' &&
                    onlyDigits(values.recipient) === active.document
                  : values.mode === 'email'
                    ? values.recipient.toLowerCase() === user?.email
                    : values.mode === 'cpf' &&
                      onlyDigits(values.recipient) === user?.cpf
              return self ? 'Não é possível transferir para a própria conta' : null
            }}
            onSubmit={(values) => setStep({ name: 'confirm', values })}
          />
        ) : step.name === 'confirm' ? (
          <ConfirmOperation
            values={step.values}
            from={active?.name}
            confirmLabel="Confirmar transferência"
            execute={(key) => transfer(key, toRequestBody(step.values))}
            onBack={() => setStep({ name: 'form', values: step.values })}
            onDone={(result) => {
              // Saldo e extrato mudaram
              void queryClient.invalidateQueries({ queryKey: queryKeys.account })
              void queryClient.invalidateQueries({
                queryKey: queryKeys.transactions,
              })
              setStep({ name: 'done', values: step.values, result })
            }}
          />
        ) : (
          <OperationReceipt
            title="Transferência realizada"
            result={step.result}
            values={step.values}
            newLabel="Fazer outra transferência"
            onNew={() => setStep({ name: 'form' })}
          />
        )}
      </Card>
    </div>
  )
}
