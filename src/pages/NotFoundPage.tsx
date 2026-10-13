import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-brand-700">Erro 404</p>
      <h1 className="mt-2 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-slate-500">O endereço pode ter mudado ou não existir.</p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
