import { FileText, Plus, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Variant = 'no-company' | 'no-data' | 'error' | 'consolidated-blocked'

interface Props {
  variant: Variant
  title?: string
  message?: string
  errorDetail?: string
  ctaHref?: string
  ctaLabel?: string
}

const DEFAULT_COPY: Record<Variant, { title: string; message: string }> = {
  'no-company': {
    title: 'Selecione uma empresa',
    message: 'Escolha uma empresa no seletor acima para visualizar este relatório.',
  },
  'no-data': {
    title: 'Nenhum lançamento cadastrado',
    message:
      'Cadastre lançamentos financeiros para esta empresa para gerar relatórios consolidados.',
  },
  'consolidated-blocked': {
    title: 'Relatório indisponível em modo consolidado',
    message:
      'Selecione uma empresa específica para ver este relatório. A visão consolidada está disponível apenas para Dashboard e Fluxo de Caixa.',
  },
  error: {
    title: 'Erro ao carregar dados',
    message:
      'Não foi possível buscar os dados financeiros. Verifique sua conexão e tente novamente.',
  },
}

export default function EmptyFinancialState({
  variant,
  title,
  message,
  errorDetail,
  ctaHref = '/lancamentos',
  ctaLabel = 'Adicionar lançamento',
}: Props) {
  const copy = DEFAULT_COPY[variant]
  const Icon = variant === 'error' ? AlertTriangle : FileText
  const showCTA = variant === 'no-data'
  const tone =
    variant === 'error'
      ? 'border-red-100 bg-red-50/40'
      : 'border-gray-100 bg-white'
  const iconColor =
    variant === 'error' ? 'text-red-300' : 'text-gray-200'

  return (
    <div
      className={`text-center py-16 px-6 rounded-xl border ${tone}`}
    >
      <Icon className={`w-10 h-10 mx-auto mb-3 ${iconColor}`} />
      <h3 className="text-sm font-semibold text-slate-700 mb-1">
        {title ?? copy.title}
      </h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        {message ?? copy.message}
      </p>
      {variant === 'error' && errorDetail && (
        <pre className="mt-3 text-xs text-red-500 bg-red-50 inline-block px-3 py-2 rounded-lg max-w-full overflow-auto">
          {errorDetail}
        </pre>
      )}
      {showCTA && (
        <Link
          to={ctaHref}
          className="inline-flex items-center gap-2 mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
