import { fmtBRL } from '../../../lib/currency'
import type { DreResult, FinancialEntry } from '../types/finance.types'

interface Props {
  dre: DreResult
  onDrillDown: (group: string, entries: FinancialEntry[]) => void
}

function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

interface RowDef {
  label: string
  value: number
  pctBase?: number
  bold?: boolean
  indent?: boolean
  highlight?: 'green' | 'red' | 'blue' | 'amber'
  group?: string
  entries?: FinancialEntry[]
}

export default function DreTable({ dre, onDrillDown }: Props) {
  const base = dre.receitaLiquida

  const rows: RowDef[] = [
    { label: 'Receita Bruta', value: dre.receitaBruta, group: 'gross_revenue', entries: dre.entriesByGroup['gross_revenue'] },
    { label: '(-) Deduções da Receita', value: -dre.deducoes, indent: true, group: 'revenue_deductions', entries: dre.entriesByGroup['revenue_deductions'] },
    { label: '= Receita Líquida', value: dre.receitaLiquida, bold: true, highlight: 'blue' },
    { label: '(-) CMV', value: -dre.cmv, pctBase: base, indent: true, group: 'cogs', entries: dre.entriesByGroup['cogs'] },
    { label: '= Lucro Bruto', value: dre.lucroBruto, bold: true, pctBase: base, highlight: dre.lucroBruto >= 0 ? 'green' : 'red' },
    { label: '(-) Despesas Comerciais', value: -dre.despesasComerciais, pctBase: base, indent: true, group: 'commercial_expenses', entries: dre.entriesByGroup['commercial_expenses'] },
    { label: '(-) Despesas Administrativas', value: -dre.despesasAdministrativas, pctBase: base, indent: true, group: 'administrative_expenses', entries: dre.entriesByGroup['administrative_expenses'] },
    { label: '(-) Despesas Operacionais', value: -dre.despesasOperacionais, pctBase: base, indent: true, group: 'operational_expenses', entries: dre.entriesByGroup['operational_expenses'] },
    { label: '= EBITDA', value: dre.ebitda, bold: true, pctBase: base, highlight: dre.ebitda >= 0 ? 'green' : 'red' },
    { label: '(-) Depreciação e Amortização', value: -dre.depreciacao, pctBase: base, indent: true, group: 'depreciation_amortization', entries: dre.entriesByGroup['depreciation_amortization'] },
    { label: '= EBIT (Resultado Operacional)', value: dre.ebit, bold: true, pctBase: base, highlight: dre.ebit >= 0 ? 'green' : 'red' },
    { label: '(+/-) Resultado Financeiro', value: dre.resultadoFinanceiro, pctBase: base, indent: true, group: 'financial_result', entries: dre.entriesByGroup['financial_result'] },
    { label: '(-) Impostos sobre Lucro', value: -dre.impostos, pctBase: base, indent: true, group: 'taxes_on_profit', entries: dre.entriesByGroup['taxes_on_profit'] },
    { label: '= Lucro Líquido', value: dre.lucroLiquido, bold: true, pctBase: base, highlight: dre.lucroLiquido >= 0 ? 'green' : 'red' },
  ]

  const highlightBg: Record<string, string> = {
    green: 'bg-emerald-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
  }
  const highlightText: Record<string, string> = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Linha</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor (R$)</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">% Rec. Líq.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowBg = row.highlight ? highlightBg[row.highlight] : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')
            const textColor = row.highlight ? highlightText[row.highlight] : (row.value >= 0 ? 'text-gray-900' : 'text-red-600')
            const canDrillDown = !!(row.group && row.entries && row.entries.length > 0)

            return (
              <tr
                key={i}
                className={`border-b border-gray-100 last:border-0 ${rowBg} ${canDrillDown ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={() => canDrillDown && row.group && row.entries && onDrillDown(row.label, row.entries)}
              >
                <td className={`px-4 py-3 ${row.indent ? 'pl-8' : ''} ${row.bold ? 'font-bold' : 'font-medium'} ${row.highlight ? highlightText[row.highlight] : 'text-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    {row.label}
                    {canDrillDown && (
                      <span className="text-xs text-blue-500 opacity-60">▼</span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-mono ${row.bold ? 'font-bold text-base' : ''} ${textColor}`}>
                  {fmtBRL(row.value)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                  {row.pctBase !== undefined && base > 0
                    ? fmtPct((row.value / base) * 100)
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
