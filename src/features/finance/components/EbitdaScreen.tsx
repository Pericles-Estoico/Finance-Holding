import { useEffect, useMemo, useState } from 'react'
import FinancialKpiCard from './FinancialKpiCard'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import EbitdaBridge from './EbitdaBridge'
import {
  calculateDRE,
  calculateEBITDA,
} from '../services/financeCalculations'
import { getChartAccounts, getFinancialEntries } from '../services/financeApi'
import {
  simulationChartAccounts,
  simulationFinancialEntries,
} from '../data/simulationData'
import { useSimulation } from '../../../contexts/SimulationContext'
import EmptyFinancialState from './EmptyFinancialState'
import { fmtBRL } from '../../../lib/currency'
import type {
  ChartAccount,
  FinancialEntry,
  DateRange,
} from '../types/finance.types'

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

function getPreviousPeriod(start: string, end: string): DateRange {
  const s = new Date(start)
  const e = new Date(end)
  const diffMs = e.getTime() - s.getTime()
  const prevEnd = new Date(s)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return {
    from: prevStart.toISOString().split('T')[0],
    to: prevEnd.toISOString().split('T')[0],
  }
}

export default function EbitdaScreen({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      if (isSimulation) {
        if (!cancelled) {
          setEntries(simulationFinancialEntries)
          setChartAccounts(simulationChartAccounts)
          setLoading(false)
        }
        return
      }

      if (!companyId || companyId === 'consolidated') {
        if (!cancelled) {
          setEntries([])
          setChartAccounts([])
          setLoading(false)
        }
        return
      }

      try {
        const [accountsData, entriesData] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
        ])
        if (cancelled) return
        setEntries(entriesData)
        setChartAccounts(accountsData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [companyId, isSimulation])

  const period = useMemo<DateRange>(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate]
  )
  const previousPeriod = useMemo(
    () => getPreviousPeriod(startDate, endDate),
    [startDate, endDate]
  )

  const periodEntries = useMemo(
    () =>
      entries.filter(
        (e) => e.competence_date >= startDate && e.competence_date <= endDate
      ),
    [entries, startDate, endDate]
  )

  const dre = useMemo(
    () => calculateDRE(entries, chartAccounts, period),
    [entries, chartAccounts, period]
  )

  const ebitda = useMemo(
    () => calculateEBITDA(dre, periodEntries, chartAccounts),
    [dre, periodEntries, chartAccounts]
  )

  const previousDre = useMemo(
    () => calculateDRE(entries, chartAccounts, previousPeriod),
    [entries, chartAccounts, previousPeriod]
  )

  const previousEbitda = useMemo(() => {
    const prevEntries = entries.filter(
      (e) =>
        e.competence_date >= previousPeriod.from &&
        e.competence_date <= previousPeriod.to
    )
    return calculateEBITDA(previousDre, prevEntries, chartAccounts)
  }, [entries, chartAccounts, previousDre, previousPeriod])

  const variation = useMemo(() => {
    if (previousEbitda.ebitda === 0) return 0
    return ((ebitda.ebitda - previousEbitda.ebitda) / Math.abs(previousEbitda.ebitda)) * 100
  }, [ebitda, previousEbitda])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tableRows = [
    { label: 'Receita Liquida', value: ebitda.netRevenue, bold: true, highlight: 'blue' as const },
    { label: '(-) CPV / CMV', value: -ebitda.cogs, indent: true },
    { label: '= Lucro Bruto', value: ebitda.grossProfit, bold: true, highlight: ebitda.grossProfit >= 0 ? ('green' as const) : ('red' as const) },
    { label: '(-) Despesas Comerciais', value: -(ebitda.byGroup['commercial_expenses'] ?? 0), indent: true },
    { label: '(-) Despesas Administrativas', value: -(ebitda.byGroup['administrative_expenses'] ?? 0), indent: true },
    { label: '(-) Despesas Operacionais', value: -(ebitda.byGroup['operational_expenses'] ?? 0), indent: true },
    { label: '= EBITDA', value: ebitda.ebitda, bold: true, highlight: ebitda.ebitda >= 0 ? ('green' as const) : ('red' as const) },
    { label: 'Margem EBITDA (%)', value: ebitda.ebitdaMargin, isPercent: true, bold: true },
  ]

  const highlightBg: Record<string, string> = {
    green: 'bg-emerald-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
  }
  const highlightText: Record<string, string> = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
  }

  const headerBlock = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">EBITDA</h1>
        <p className="text-sm text-gray-500">
          Lucro antes de juros, impostos, depreciacao e amortizacao
        </p>
      </div>
      {onPeriodChange && (
        <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
      )}
    </div>
  )

  if (!isSimulation) {
    if (error) {
      return <div className="space-y-6">{headerBlock}<EmptyFinancialState variant="error" errorDetail={error} /></div>
    }
    if (!companyId) {
      return <div className="space-y-6">{headerBlock}<EmptyFinancialState variant="no-company" /></div>
    }
    if (companyId === 'consolidated') {
      return <div className="space-y-6">{headerBlock}<EmptyFinancialState variant="consolidated-blocked" /></div>
    }
    if (entries.length === 0) {
      return <div className="space-y-6">{headerBlock}<EmptyFinancialState variant="no-data" /></div>
    }
  }

  return (
    <div className="space-y-6">
      {headerBlock}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <FinancialKpiCard
          title="Receita Liquida"
          value={fmtBRL(ebitda.netRevenue)}
          subtitle="Base do EBITDA"
          variant="positive"
        />
        <FinancialKpiCard
          title="Lucro Bruto"
          value={fmtBRL(ebitda.grossProfit)}
          subtitle="Receita - CPV"
          variant={ebitda.grossProfit >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Despesas Op. Elegiveis"
          value={fmtBRL(ebitda.eligibleExpenses)}
          subtitle="Comerciais + Adm + Op"
          variant="default"
        />
        <FinancialKpiCard
          title="EBITDA"
          value={fmtBRL(ebitda.ebitda)}
          subtitle="Lucro op. ajustado"
          variant={ebitda.ebitda >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Margem EBITDA"
          value={fmtPct(ebitda.ebitdaMargin)}
          subtitle="EBITDA / Rec. liquida"
          variant={ebitda.ebitdaMargin >= 15 ? 'positive' : ebitda.ebitdaMargin >= 0 ? 'default' : 'negative'}
        />
        <FinancialKpiCard
          title="Variacao vs Periodo Anterior"
          value={fmtPct(variation)}
          subtitle={`Anterior: ${fmtBRL(previousEbitda.ebitda)}`}
          trend={variation}
          variant={variation >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">EBITDA Detalhado</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Linha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => {
                  const rowBg = row.highlight ? highlightBg[row.highlight] : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  const textColor = row.highlight ? highlightText[row.highlight] : row.value >= 0 ? 'text-gray-900' : 'text-red-600'
                  return (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${rowBg}`}>
                      <td className={`px-4 py-3 ${row.indent ? 'pl-8' : ''} ${row.bold ? 'font-bold' : 'font-medium'} ${row.highlight ? highlightText[row.highlight] : 'text-gray-700'}`}>
                        {row.label}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${row.bold ? 'font-bold text-base' : ''} ${textColor}`}>
                        {row.isPercent ? fmtPct(row.value) : fmtBRL(row.value)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <EbitdaBridge ebitda={ebitda} dre={dre} />
      </div>

      {ebitda.excludedItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Itens Excluidos do EBITDA</h3>
          <p className="text-xs text-gray-500 mb-4">
            Juros, depreciacao, amortizacao, impostos sobre lucro, investimentos e
            movimentacoes de capital nao impactam o EBITDA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ebitda.excludedItems.map((item) => (
              <div key={item.group} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-600 capitalize">
                  {item.group.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold font-mono text-gray-700">
                  {fmtBRL(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
