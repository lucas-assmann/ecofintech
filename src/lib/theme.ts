import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// Mesma chave usada pelo script do index.html
const KEY = 'ecofintech.theme'
const systemQuery = '(prefers-color-scheme: dark)'

/** Tema salvo neste navegador, ou null se a pessoa nunca escolheu (segue o sistema). */
function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (matchMedia(systemQuery).matches ? 'dark' : 'light')

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Tema atual e função para alternar entre claro e escuro. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme())

  // Sem escolha salva, acompanha quando o sistema muda de tema
  useEffect(() => {
    const media = matchMedia(systemQuery)
    const onChange = () => {
      if (savedTheme()) return
      const next = systemTheme()
      apply(next)
      setTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    apply(next)
    setTheme(next)
  }

  return { theme, toggle }
}
