import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { FinancialEntry, ChartAccount } from '../types/finance.types'
import type { ChartAccountV2 } from '../services/corporateChartApi'

interface Props {
  entries: FinancialEntry[]
  chartAccounts: ChartAccount[]
  chartAccountsV2?: ChartAccountV2[]
}

interface Issue {
  severity: 'error' | 'warning'
  message: string
  count: number
}

export default function FinancialDataHealthCheck({ entries, chartAccounts, chartAccountsV2: _chartAccountsV2 = [] }: Props) {
  const issues: Issue[] = []

  const accountsWithDreButNoGroup = chartAccounts.filter(
    (a) => a.affects_dre && !a.dre_group
  )
  if (accountsWithDreButNoGroup.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'Contas com "Afeta DRE" mas sem grupo DRE definido',
      count: accountsWithDreButNoGroup.length,
    })
  }

  const paidWithoutDate = entries.filter(
    (e) =>
      (e.status === 'paid' || e.status === 'received') &&
      !e.paid_or_received_date
  )
  if (paidWithoutDate.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'Lançamentos pagos/recebidos sem data de liquidação',
      count: paidWithoutDate.length,
    })
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Dados financeiros sem inconsistências detectadas.</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            issue.severity === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">{issue.message}</span>
            <span className="ml-2 opacity-70">({issue.count} item{issue.count !== 1 ? 's' : ''})</span>
          </div>
        </div>
      ))}
    </div>
  )
}
