import { useState } from 'react'
import type { Transaction } from '../../api/client'
import { deposit } from '../../api/requests'
import {
  toRequestBody,
  type MoneyOperationValues,
} from '../../lib/money-operation'
import { MoneyOperationForm } from '../../components/MoneyOperationForm'
import {
  ConfirmOperation,
  OperationReceipt,
} from '../../components/ConfirmOperation'
import { Card, PageHeader } from '../../components/ui/Card'

type Step =
  | { name: 'form'; values?: MoneyOperationValues }
  | { name: 'confirm'; values: MoneyOperationValues }
  | { name: 'done'; values: MoneyOperationValues; result: Transaction }

export function AdminDepositPage() {
  const [step, setStep] = useState<Step>({ name: 'form' })

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Depósito"
        description="Credita dinheiro vindo de fora na conta de um cliente. Fica registrado qual administrador fez o depósito."
      />
      <Card>
        {step.name === 'form' ? (
          <MoneyOperationForm
            defaultValues={step.values}
            submitLabel="Continuar"
            onSubmit={(values) => setStep({ name: 'confirm', values })}
          />
        ) : step.name === 'confirm' ? (
          <ConfirmOperation
            values={step.values}
            confirmLabel="Confirmar depósito"
            execute={(key) => deposit(key, toRequestBody(step.values))}
            onBack={() => setStep({ name: 'form', values: step.values })}
            onDone={(result) => setStep({ name: 'done', values: step.values, result })}
          />
        ) : (
          <OperationReceipt
            title="Depósito realizado"
            result={step.result}
            values={step.values}
            newLabel="Fazer outro depósito"
            onNew={() => setStep({ name: 'form' })}
          />
        )}
      </Card>
    </div>
  )
}
