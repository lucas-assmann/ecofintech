import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'

/** Tela dividida: painel da marca à esquerda (desktop) e formulário à direita. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo light />
        <div className="relative z-10 max-w-md">
          <p className="text-4xl font-bold leading-tight">
            Seu dinheiro, simples e transparente.
          </p>
          <p className="mt-4 text-lg text-brand-100">
            Transfira por e-mail ou CPF, acompanhe cada centavo no extrato e
            fale com o suporte quando precisar.
          </p>
        </div>
        <p className="relative z-10 text-sm text-brand-200">
          Ambiente de desenvolvimento
        </p>
        <div
          aria-hidden="true"
          className="absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-brand-700/60"
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-12 size-72 rounded-full bg-brand-600/40"
        />
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
