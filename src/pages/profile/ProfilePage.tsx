import { useAuth } from '../../auth/context'
import { formatDate } from '../../lib/format'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/Card'
import { DeactivationCard } from './DeactivationCard'
import { PasswordCard } from './PasswordCard'
import { PersonalDataCard } from './PersonalDataCard'

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Perfil"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Cliente desde {formatDate(user.created_at)}
            {user.role === 'admin' && <Badge tone="blue">Administrador</Badge>}
          </span>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <PersonalDataCard user={user} />
        <div className="space-y-6">
          <PasswordCard userId={user.id} />
          <DeactivationCard />
        </div>
      </div>
    </div>
  )
}
