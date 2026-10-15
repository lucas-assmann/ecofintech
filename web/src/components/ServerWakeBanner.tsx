import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../api/client'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

type Status = 'checking' | 'waking' | 'online' | 'offline'

/**
 * A API roda no plano gratuito do Render, que "dorme" após 15 minutos sem uso
 * e leva até ~1 minuto para acordar. Assim que o site abre, este componente
 * chama a rota de saúde da API (o que já começa a acordá-la) e, se ela demorar,
 * avisa a pessoa em vez de deixar a tela parecendo travada.
 */
export function ServerWakeBanner({
  slowAfterMs = 3_000,
  retryMs = 3_000,
  giveUpMs = 120_000,
}: {
  /** Depois de quanto tempo sem resposta o aviso aparece */
  slowAfterMs?: number
  /** Intervalo entre tentativas quando a API ainda não respondeu */
  retryMs?: number
  /** Depois de quanto tempo desiste e mostra o erro */
  giveUpMs?: number
}) {
  const [status, setStatus] = useState<Status>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    const startedAt = Date.now()

    // Só mostra o aviso se demorar: com a API acordada, nada aparece
    const slowTimer = setTimeout(() => {
      if (!cancelled) setStatus('waking')
    }, slowAfterMs)

    async function ping() {
      try {
        const response = await fetch(`${API_URL}/`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (response.ok) {
          clearTimeout(slowTimer)
          if (!cancelled) setStatus('online')
          return
        }
      } catch {
        // Falha de rede ou 502 enquanto o Render liga a API: tenta de novo
      }
      if (cancelled) return
      if (Date.now() - startedAt >= giveUpMs) {
        clearTimeout(slowTimer)
        setStatus('offline')
        return
      }
      retryTimer = setTimeout(ping, retryMs)
    }

    void ping()

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(slowTimer)
      clearTimeout(retryTimer)
    }
  }, [attempt, slowAfterMs, retryMs, giveUpMs])

  const retry = useCallback(() => {
    setStatus('waking')
    setAttempt((n) => n + 1)
  }, [])

  if (status === 'checking' || status === 'online') return null

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="w-full max-w-md shadow-lg">
        {status === 'waking' ? (
          <Alert tone="warning">
            <div className="flex items-start gap-3">
              <Spinner className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">Ligando o servidor...</p>
                <p className="mt-1">
                  A API fica em um plano gratuito que desliga quando ninguém
                  usa. O primeiro acesso pode levar até 1 minuto; depois fica
                  rápido.
                </p>
              </div>
            </div>
          </Alert>
        ) : (
          <Alert tone="error" title="Não foi possível conectar ao servidor">
            <p>Verifique sua internet e tente novamente.</p>
            <div className="mt-3">
              <Button onClick={retry}>Tentar novamente</Button>
            </div>
          </Alert>
        )}
      </div>
    </div>
  )
}
