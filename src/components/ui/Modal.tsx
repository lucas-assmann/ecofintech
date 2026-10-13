import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Janela modal usando o <dialog> nativo: foco, tecla Esc e fundo escurecido
 * já vêm do navegador.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clique fora do conteúdo (no fundo) fecha
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-xl ring-1 ring-transparent backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800 dark:backdrop:bg-black/70"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-m-1 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg viewBox="0 0 20 20" className="size-5" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
