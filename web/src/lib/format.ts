const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** "1234.5" ou 1234.5 → "R$ 1.234,50". A API manda valores como texto ("200.00"). */
export function formatMoney(value: string | number): string {
  return brl.format(Number(value))
}

/** "2026-10-13T03:28:14.918Z" → "13/10/2026 00:28" (fuso do navegador) */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** "2026-10-13T03:28:14.918Z" → "13 de out. de 2026" */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(iso),
  )
}

/** Data sem horário vinda da API ("1995-08-20") → "20/08/1995", sem conversão de fuso */
export function formatPlainDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Formata o CPF enquanto digita: "52998224725" → "529.982.247-25" */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/** Formata o CNPJ enquanto digita: "11222333000181" → "11.222.333/0001-81" */
export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** CPF parcialmente oculto, para exibir em listas: "***.982.247-**" */
export function maskCpf(value: string): string {
  const formatted = formatCpf(value)
  return `***${formatted.slice(3, 11)}-**`
}

/** Formata o telefone enquanto digita: "11987654321" → "(11) 98765-4321" */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Primeiro nome, para saudações */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Valor resumido para eixos de gráfico: 1500 → "R$ 1,5 mil" */
export function formatMoneyCompact(value: number): string {
  return brlCompact.format(value)
}

/** Dia sem horário vindo da API ("2026-10-13") → "13/10", sem conversão de fuso */
export function formatDayMonth(date: string): string {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

/** Soma dias a uma data sem horário: ("2026-10-13", 6) → "2026-10-19" */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
