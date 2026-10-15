import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

export const inputClass =
  'block w-full min-h-11 rounded-xl border-0 bg-white dark:bg-slate-900 px-3.5 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 aria-invalid:ring-red-500'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  /** Recebe o id e os atributos de acessibilidade para ligar o input ao rótulo */
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby'?: string
  }) => ReactNode
}

/** Rótulo + campo + mensagem de erro, com os atributos de acessibilidade ligados. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`${inputClass} ${className}`} {...props} />
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={`${inputClass} py-2.5 ${className}`}
      {...props}
    />
  )
})
