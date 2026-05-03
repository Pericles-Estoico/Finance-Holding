import { useEffect, useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { validateAccountingEquation } from '../services/ifrsEngine'
import { getCorporateChart } from '../services/corporateChartApi'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import type { FinancialEntry } from '../types/finance.types'
import { fmtBRL } from '../../../lib/currency'

interface Props {
  companyId: string
  entries: FinancialEntry[]
}

const ZERO = new Decimal(0)

export default function AccountingEquationAlert({ companyId, entries }: Props) {
  const [v2Accounts, setV2Accounts] = useState<ChartAccountV2[]>([])
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!companyId || companyId === 'consolidated') return
    getCorporateChart(companyId)
      .then(setV2Accounts)
      .catch(() => setV2Accounts([]))
  }, [companyId])

  // Saldo de cada conta: soma cumulativa de todos os lançamentos (sem filtro de período)
  const balanceMap = useMemo(() => {
    const map = new Map<string, Decimal>()
    for (const entry of entries) {
      if (!entry.chart_account_v2_id || entry.status === 'cancelled') continue
      const prev = map.get(entry.chart_account_v2_id) ?? ZERO
      map.set(entry.chart_account_v2_id, prev.plus(new Decimal(entry.amount)))
    }
    return map
  }, [entries])

  const result = useMemo(() => {
    if (v2Accounts.length === 0) return null
    return validateAccountingEquation(
      v2Accounts,
      (account) => balanceMap.get(account.id) ?? ZERO
    )
  }, [v2Accounts, balanceMap])

  // Não renderiza enquanto não tiver contas v2 ou se não houve transações no BP
  if (!result) return null

  const { balanced, assets, liabilities, equity, delta } = result

  if (balanced) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
        <span className="font-semibold">Equação Contábil Balanceada</span>
        <span className="text-emerald-500">
          Ativos {fmtBRL(assets.toNumber())} = Passivos {fmtBRL(liabilities.toNumber())} + PL {fmtBRL(equity.toNumber())}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Equação Contábil Desbalanceada — Diferença: {fmtBRL(delta.toNumber())}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Ativos ≠ Passivos + Patrimônio Líquido. Verifique lançamentos inconsistentes.
          </p>
        </div>
        <button
          onClick={() => setShowDetails(v => !v)}
          className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 shrink-0"
        >
          Detalhes {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showDetails && (
        <div className="border-t border-amber-200 px-4 py-3 bg-amber-50/60">
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-amber-600 font-medium">Ativos</p>
              <p className="font-mono font-semibold text-slate-700 mt-0.5">{fmtBRL(assets.toNumber())}</p>
            </div>
            <div>
              <p className="text-amber-600 font-medium">Passivos</p>
              <p className="font-mono font-semibold text-slate-700 mt-0.5">{fmtBRL(liabilities.toNumber())}</p>
            </div>
            <div>
              <p className="text-amber-600 font-medium">Patrimônio Líquido</p>
              <p className="font-mono font-semibold text-slate-700 mt-0.5">{fmtBRL(equity.toNumber())}</p>
            </div>
            <div>
              <p className="text-red-500 font-medium">Diferença</p>
              <p className="font-mono font-semibold text-red-600 mt-0.5">{fmtBRL(delta.toNumber())}</p>
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Tolerância aplicada: R$0,01. Acesse "Plano Corporativo" nas Configurações para verificar as contas.
          </p>
        </div>
      )}
    </div>
  )
}
