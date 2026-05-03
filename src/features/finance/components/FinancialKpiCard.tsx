import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  title: string
  value: string
  subtitle?: string
  trend?: number
  variant?: 'default' | 'positive' | 'negative' | 'warning'
  onClick?: () => void
}

const variantStyles: Record<string, string> = {
  default: 'bg-white border-gray-200',
  positive: 'bg-white border-emerald-200',
  negative: 'bg-white border-red-200',
  warning: 'bg-white border-amber-200',
}

const valueStyles: Record<string, string> = {
  default: 'text-gray-900',
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  warning: 'text-amber-600',
}

export default function FinancialKpiCard({
  title,
  value,
  subtitle,
  trend,
  variant = 'default',
  onClick,
}: Props) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all ${variantStyles[variant]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-2xl font-bold leading-tight ${valueStyles[variant]}`}>{value}</p>
      <div className="flex items-center justify-between mt-2">
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        {typeof trend === 'number' && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              trend >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}
