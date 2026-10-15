import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { TransactionSummary } from '../api/client'
import {
  addDays,
  formatDayMonth,
  formatMoney,
  formatMoneyCompact,
} from '../lib/format'

type Bucket = TransactionSummary['series'][number]

// Medidas do gráfico (px)
const PLOT_HEIGHT = 220
const TOP = 24 // espaço para o rótulo do maior valor
const AXIS_HEIGHT = 28 // faixa das datas embaixo
const LEFT = 72 // espaço para os valores do eixo Y
const RIGHT = 8
const GAP = 2 // espaço entre a barra de entrada e a de saída

/** Largura do elemento, atualizada quando a tela muda de tamanho. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Valores "redondos" para as linhas de grade: 0, 500, 1.000, 1.500... */
function niceTicks(max: number): number[] {
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough)! * magnitude
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

/** Barra com o topo arredondado (4px) e a base reta, apoiada no eixo. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/** Texto do intervalo: "13/10" (dia) ou "16/07 a 22/07" (semana). */
function bucketLabel(summary: TransactionSummary, bucket: Bucket): string {
  if (summary.bucket === 'day') return formatDayMonth(bucket.date)
  const end = addDays(bucket.date, 6)
  return `${formatDayMonth(bucket.date)} a ${formatDayMonth(end > summary.to ? summary.to : end)}`
}

const indexOfMax = (values: number[]) =>
  values.reduce((best, v, i) => (v > values[best] ? i : best), 0)

export function CashFlowChart({ summary }: { summary: TransactionSummary }) {
  const [wrapperRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const series = summary.series
  const entradas = series.map((b) => Number(b.entradas))
  const saidas = series.map((b) => Number(b.saidas))
  const max = Math.max(...entradas, ...saidas)

  const moveActive = (event: KeyboardEvent) => {
    const last = series.length - 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const step = event.key === 'ArrowLeft' ? -1 : 1
      setActive((i) => Math.min(last, Math.max(0, (i ?? last) + step)))
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  return (
    <div ref={wrapperRef} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-sm bg-entrada" />
            Entradas
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-sm bg-saida" />
            Saídas
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60"
        >
          {showTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {showTable ? (
        <SummaryTable summary={summary} />
      ) : max === 0 ? (
        <div className="grid h-[272px] place-items-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            <span className="block font-medium text-slate-700 dark:text-slate-300">
              Nenhuma movimentação no período
            </span>
            Quando você receber ou enviar dinheiro, o gráfico aparece aqui.
          </p>
        </div>
      ) : (
        <div
          className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          tabIndex={0}
          role="group"
          aria-label="Gráfico de entradas e saídas. Use as setas para percorrer o período, ou 'Ver tabela' para todos os valores."
          onKeyDown={moveActive}
          onFocus={() => setActive((i) => i ?? series.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {width > 0 && (
            <Plot
              summary={summary}
              width={width}
              entradas={entradas}
              saidas={saidas}
              max={max}
              active={active}
              onActive={setActive}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface PlotProps {
  summary: TransactionSummary
  width: number
  entradas: number[]
  saidas: number[]
  max: number
  active: number | null
  onActive: (index: number) => void
}

function Plot({ summary, width, entradas, saidas, max, active, onActive }: PlotProps) {
  const n = summary.series.length
  const plotWidth = width - LEFT - RIGHT
  const band = plotWidth / n
  // Barras finas (no máximo 16px), deixando ar entre os dias
  const barWidth = Math.max(2, Math.min(16, (band * 0.7 - GAP) / 2))
  const pairWidth = barWidth * 2 + GAP

  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const y = (value: number) => TOP + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT
  const xPair = (i: number) => LEFT + i * band + (band - pairWidth) / 2

  // Datas do eixo X: cabem ~1 a cada 56px, sempre incluindo o último dia
  const every = Math.ceil(n / Math.max(1, Math.floor(plotWidth / 56)))
  const showDate = (i: number) => (n - 1 - i) % every === 0

  // Rótulos só no maior valor de cada série (um número em cada barra vira ruído)
  const peakIn = indexOfMax(entradas)
  const peakOut = indexOfMax(saidas)
  const peaks = [
    { i: peakIn, value: entradas[peakIn], x: xPair(peakIn) + barWidth / 2 },
    { i: peakOut, value: saidas[peakOut], x: xPair(peakOut) + barWidth * 1.5 + GAP },
  ]
    .filter((p) => p.value > 0)
    // No mesmo dia os dois rótulos se sobrepõem: fica só o maior
    .filter((p, _, all) => all.every((o) => o.i !== p.i || o.value <= p.value))

  const height = TOP + PLOT_HEIGHT + AXIS_HEIGHT
  const bucket = active !== null ? summary.series[active] : null

  return (
    <>
      <svg width={width} height={height} className="block w-full select-none" aria-hidden="true">
        {/* Grade e valores do eixo Y */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={width - RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={LEFT - 10}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="tabular fill-slate-500 dark:fill-slate-400 text-[11px]"
            >
              {formatMoneyCompact(tick)}
            </text>
          </g>
        ))}

        {/* Faixa do dia em destaque */}
        {active !== null && (
          <rect
            x={LEFT + active * band}
            y={TOP}
            width={band}
            height={PLOT_HEIGHT}
            className="fill-slate-100 dark:fill-slate-800"
          />
        )}

        {summary.series.map((b, i) => {
          const x = xPair(i)
          const dim = active !== null && active !== i
          return (
            <g key={b.date} opacity={dim ? 0.45 : 1}>
              {entradas[i] > 0 && (
                <path
                  d={barPath(x, y(entradas[i]), barWidth, TOP + PLOT_HEIGHT - y(entradas[i]))}
                  className="fill-entrada"
                />
              )}
              {saidas[i] > 0 && (
                <path
                  d={barPath(x + barWidth + GAP, y(saidas[i]), barWidth, TOP + PLOT_HEIGHT - y(saidas[i]))}
                  className="fill-saida"
                />
              )}
              {showDate(i) && (
                <text
                  x={LEFT + i * band + band / 2}
                  y={TOP + PLOT_HEIGHT + 18}
                  textAnchor="middle"
                  className="tabular fill-slate-500 dark:fill-slate-400 text-[11px]"
                >
                  {formatDayMonth(b.date)}
                </text>
              )}
            </g>
          )
        })}

        {peaks.map((p) => (
          <text
            key={p.i + '-' + p.value}
            x={Math.min(Math.max(p.x, LEFT + 30), width - RIGHT - 30)}
            y={y(p.value) - 8}
            textAnchor="middle"
            className="fill-slate-700 dark:fill-slate-300 text-[11px] font-semibold"
          >
            {formatMoneyCompact(p.value)}
          </text>
        ))}

        {/* Eixo (linha de base) */}
        <line
          x1={LEFT}
          x2={width - RIGHT}
          y1={TOP + PLOT_HEIGHT}
          y2={TOP + PLOT_HEIGHT}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />

        {/* Área de toque: o dia inteiro, não só a barra */}
        {summary.series.map((b, i) => (
          <rect
            key={b.date}
            x={LEFT + i * band}
            y={0}
            width={band}
            height={height}
            fill="transparent"
            onPointerEnter={() => onActive(i)}
            onPointerDown={() => onActive(i)}
          />
        ))}
      </svg>

      <div aria-live="polite" className="sr-only">
        {bucket &&
          `${bucketLabel(summary, bucket)}: entradas ${formatMoney(bucket.entradas)}, saídas ${formatMoney(bucket.saidas)}`}
      </div>

      {bucket && active !== null && (
        <Tooltip
          summary={summary}
          bucket={bucket}
          // Centro do dia, sem deixar o balão sair do gráfico
          left={Math.min(Math.max(LEFT + active * band + band / 2, 100), width - 100)}
        />
      )}
    </>
  )
}

function Tooltip({
  summary,
  bucket,
  left,
}: {
  summary: TransactionSummary
  bucket: Bucket
  left: number
}) {
  const net = Number(bucket.entradas) - Number(bucket.saidas)
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-xl bg-white dark:bg-slate-900 p-3 text-sm shadow-lg ring-1 ring-slate-200 dark:ring-slate-800"
      style={{ left }}
    >
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {summary.bucket === 'week' ? 'Semana de ' : ''}
        {bucketLabel(summary, bucket)}
      </p>
      <div className="space-y-1.5">
        {[
          { label: 'Entradas', value: bucket.entradas, key: 'bg-entrada' },
          { label: 'Saídas', value: bucket.saidas, key: 'bg-saida' },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-0.5 w-3 rounded-full ${row.key}`} />
            <span className="tabular font-semibold text-slate-900 dark:text-slate-100">{formatMoney(row.value)}</span>
            <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-1.5">
          <span aria-hidden="true" className="w-3" />
          <span className="tabular font-semibold text-slate-900 dark:text-slate-100">
            {net > 0 ? '+ ' : net < 0 ? '− ' : ''}
            {formatMoney(Math.abs(net))}
          </span>
          <span className="text-slate-500 dark:text-slate-400">Resultado</span>
        </div>
      </div>
    </div>
  )
}

/** Os mesmos números do gráfico, em tabela (acessível e sem depender de cor). */
function SummaryTable({ summary }: { summary: TransactionSummary }) {
  // Mais recentes primeiro, igual ao extrato
  const rows = [...summary.series].reverse()
  return (
    <div className="max-h-[272px] overflow-y-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {summary.bucket === 'week' ? 'Semana' : 'Dia'}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Entradas</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Saídas</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((b) => {
            const net = Number(b.entradas) - Number(b.saidas)
            return (
              <tr key={b.date}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                  {bucketLabel(summary, b)}
                </th>
                <td className="px-3 py-2 text-right">{formatMoney(b.entradas)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(b.saidas)}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {net > 0 ? '+ ' : net < 0 ? '− ' : ''}
                  {formatMoney(Math.abs(net))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
