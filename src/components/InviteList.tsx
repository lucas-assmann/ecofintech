import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PendingInvite } from '../api/client'
import { errorMessage } from '../api/client'
import { queryKeys } from '../api/queries'
import { acceptInvite, declineInvite } from '../api/requests'
import { formatCnpj } from '../lib/format'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { BuildingIcon } from './icons'

/** Convites pendentes para participar de empresas, com Aceitar/Recusar. */
export function InviteList({ invites }: { invites: PendingInvite[] }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (invite: PendingInvite, accept: boolean) => {
    setBusy(invite.id)
    setError(null)
    try {
      await (accept ? acceptInvite(invite.id) : declineInvite(invite.id))
      // Aceitar faz a empresa aparecer nas contas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <ul className="space-y-3">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
              <BuildingIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {invite.company.trade_name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                CNPJ {formatCnpj(invite.company.cnpj)} · convite de {invite.invited_by.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => respond(invite, false)}
                disabled={busy !== null}
              >
                Recusar
              </Button>
              <Button
                onClick={() => respond(invite, true)}
                loading={busy === invite.id}
                disabled={busy !== null}
              >
                Aceitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
