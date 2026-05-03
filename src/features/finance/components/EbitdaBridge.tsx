import { fmtBRL } from '../../../lib/currency'
import type { EbitdaResult, DreResult } from '../types/finance.types'

interface Props {
  ebitda: EbitdaResult
  dre: DreResult
}

interface BridgeItem {
  label: string
  value: number
  isAddition: boolean
}

export default function EbitdaBridge({ ebitda, dre }: Props) {
  const items: BridgeItem[] = [
    { label: 'Lucro Líquido', value: dre.lucroLiquido, isAddition: false },
    { label: '(+) Impostos sobre Lucro', value: dre.impostos, isAddition: true },
    { label: '(+/-) Resultado Financeiro', value: -dre.resultadoFinanceiro, isAddition: dre.resultadoFinanceiro <= 0 },
    { label: '(+) Depreciação e Amortização', value: dre.depreciacao, isAddition: true },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Ponte: Lucro Líquido → EBITDA</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className={`text-sm font-semibold font-mono ${item.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {item.value >= 0 ? '+' : ''}{fmtBRL(item.value)}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
          <span className="font-bold text-gray-900">= EBITDA</span>
          <span className={`font-bold text-lg font-mono ${ebitda.ebitda >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtBRL(ebitda.ebitda)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Margem EBITDA</span>
          <span className="font-semibold">{ebitda.ebitdaMargin.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
