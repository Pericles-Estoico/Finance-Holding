import { useEffect, useMemo, useState } from 'react'
import FinancialKpiCard from './FinancialKpiCard'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import DreTable from './DreTable'
import DrillDownModal from './DrillDownModal'
import { calculateDRE, ifrsDREToLegacy } from '../services/financeCalculations'
import { calculateIFRSDRE } from '../services/ifrsEngine'
import { getChartAccounts, getFinancialEntries, getConsolidatedEntries, getCostCenters } from '../services/financeApi'
import { getCorporateChart } from '../services/corporateChartApi'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import {
  mockChartAccounts,
  mockFinancialEntries,
} from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
import { fmtBRL } from '../../../lib/currency'
import type {
  ChartAccount,
  FinancialEntry,
  CostCenter,
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

function fmtVar(curr: number, prev: number): { label: string; positive: boolean } {
  if (prev === 0) return { label: '—', positive: curr >= 0 }
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return { label: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct >= 0 }
}

export default function DreScreen({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [chartAccountsV2, setChartAccountsV2] = useState<ChartAccountV2[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillEntries, setDrillEntries] = useState<FinancialEntry[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // Story 2.3: toggle consolidado e filtro canal
  const [consolidated, setConsolidated] = useState(false)
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      if (isSimulation || !companyId || companyId === 'consolidated') {
        if (!cancelled) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
          setLoading(false)
        }
        return
      }

      try {
        const [accountsData, entriesData, accountsV2Data, costCentersData] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
          getCorporateChart(companyId).catch(() => [] as ChartAccountV2[]),
          getCostCenters(companyId).catch(() => [] as CostCenter[]),
        ])
        if (cancelled) return
        if (entriesData.length === 0 || accountsData.length === 0) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
        } else {
          setEntries(entriesData)
          setChartAccounts(accountsData)
          setChartAccountsV2(accountsV2Data)
          setCostCenters(costCentersData)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        setEntries(mockFinancialEntries)
        setChartAccounts(mockChartAccounts)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [companyId, isSimulation])

  // Quando consolidado é ativado, buscar lançamentos de todas as empresas
  useEffect(() => {
    if (!consolidated || isSimulation || !companyId) return
    let cancelled = false
    getConsolidatedEntries()
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [consolidated, companyId, isSimulation])

  // Quando voltamos ao individual, recarregar lançamentos da empresa
  useEffect(() => {
    if (consolidated || isSimulation || !companyId || companyId === 'consolidated') return
    let cancelled = false
    getFinancialEntries(companyId)
      .then((data) => {
        if (!cancelled && data.length > 0) setEntries(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [consolidated, companyId, isSimulation])

  const period = useMemo<DateRange>(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate]
  )

  const previousPeriod = useMemo(
    () => getPreviousPeriod(startDate, endDate),
    [startDate, endDate]
  )

  // Filtragem por centro de custo (canal)
  const filteredEntries = useMemo(() => {
    if (selectedCostCenter === 'all') return entries
    return entries.filter((e) => e.cost_center_id === selectedCostCenter)
  }, [entries, selectedCostCenter])

  const useIFRS = chartAccountsV2.length > 0

  const dre = useMemo(
    () =>
      useIFRS
        ? ifrsDREToLegacy(calculateIFRSDRE(filteredEntries, chartAccountsV2, period))
        : calculateDRE(filteredEntries, chartAccounts, period),
    [filteredEntries, chartAccounts, chartAccountsV2, period, useIFRS]
  )

  const prevDre = useMemo(
    () =>
      useIFRS
        ? ifrsDREToLegacy(calculateIFRSDRE(filteredEntries, chartAccountsV2, previousPeriod))
        : calculateDRE(filteredEntries, chartAccounts, previousPeriod),
    [filteredEntries, chartAccounts, chartAccountsV2, previousPeriod, useIFRS]
  )

  // Etiqueta de contexto
  const contextLabel = useMemo(() => {
    const parts: string[] = []
    if (consolidated) parts.push('Consolidado')
    if (selectedCostCenter !== 'all') {
      const cc = costCenters.find((c) => c.id === selectedCostCenter)
      if (cc) parts.push(cc.name)
    }
    const month = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    parts.push(month)
    return parts.join(' · ')
  }, [consolidated, selectedCostCenter, costCenters, startDate])

  function handleDrillDown(group: string, list: FinancialEntry[]) {
    setDrillTitle(group)
    setDrillEntries(list)
    setDrillOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DRE</h1>
          <p className="text-sm text-gray-500">
            Demonstrativo de Resultado por regime de competência
          </p>
        </div>
        {onPeriodChange && (
          <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
        )}
      </div>

      {/* Story 2.3: controles de consolidado e canal */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => { setConsolidated(false); setSelectedCostCenter('all') }}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${!consolidated ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Individual
          </button>
          <button
            onClick={() => { setConsolidated(true); setSelectedCostCenter('all') }}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${consolidated ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Consolidado
          </button>
        </div>

        {costCenters.length > 0 && (
          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            disabled={consolidated}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">Todos os Canais</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>{cc.name}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-gray-400 ml-auto">{contextLabel}</span>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {error} - exibindo dados de demonstração.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FinancialKpiCard
          title="Receita Líquida"
          value={fmtBRL(dre.receitaLiquida)}
          subtitle={`Bruta: ${fmtBRL(dre.receitaBruta)}`}
          variant="positive"
        />
        <FinancialKpiCard
          title="Lucro Bruto"
          value={fmtBRL(dre.lucroBruto)}
          subtitle={`Margem: ${fmtPct(dre.margemBruta)}`}
          variant={dre.lucroBruto >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="EBITDA"
          value={fmtBRL(dre.ebitda)}
          subtitle={`Margem: ${fmtPct(dre.margemEbitda)}`}
          variant={dre.ebitda >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Lucro Líquido"
          value={fmtBRL(dre.lucroLiquido)}
          subtitle="Resultado final"
          variant={dre.lucroLiquido >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Margem Líquida"
          value={fmtPct(dre.margemLiquida)}
          subtitle="Lucro / Rec. líquida"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">DRE Detalhada</h3>
            <p className="text-xs text-gray-500">
              Clique em uma linha para ver os lançamentos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowComparison((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showComparison ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              Comparar período anterior
            </button>
            <span className="text-xs text-gray-400">
              Regime: <span className="font-semibold text-gray-600">Competência</span>
            </span>
          </div>
        </div>
        <DreTable dre={dre} onDrillDown={handleDrillDown} />
      </div>

      {showComparison && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-1">DRE Comparativa</h3>
          <p className="text-xs text-gray-500 mb-4">
            Período atual vs. período anterior ({previousPeriod.from} a {previousPeriod.to})
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Linha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Período Atual</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Período Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: 'Receita Bruta', curr: dre.receitaBruta, prev: prevDre.receitaBruta, bold: false },
                  { label: '(-) Deduções', curr: -dre.deducoes, prev: -prevDre.deducoes, bold: false },
                  { label: '= Receita Líquida', curr: dre.receitaLiquida, prev: prevDre.receitaLiquida, bold: true },
                  { label: '(-) CMV / CPV', curr: -dre.cmv, prev: -prevDre.cmv, bold: false },
                  { label: '= Lucro Bruto', curr: dre.lucroBruto, prev: prevDre.lucroBruto, bold: true },
                  { label: '(-) Desp. Comerciais', curr: -dre.despesasComerciais, prev: -prevDre.despesasComerciais, bold: false },
                  { label: '(-) Desp. Administrativas', curr: -dre.despesasAdministrativas, prev: -prevDre.despesasAdministrativas, bold: false },
                  { label: '(-) Desp. Operacionais', curr: -dre.despesasOperacionais, prev: -prevDre.despesasOperacionais, bold: false },
                  { label: '= EBITDA', curr: dre.ebitda, prev: prevDre.ebitda, bold: true },
                  { label: '(-) D&A', curr: -dre.depreciacao, prev: -prevDre.depreciacao, bold: false },
                  { label: '= EBIT', curr: dre.ebit, prev: prevDre.ebit, bold: true },
                  { label: 'Resultado Financeiro', curr: dre.resultadoFinanceiro, prev: prevDre.resultadoFinanceiro, bold: false },
                  { label: '(-) Impostos s/ Lucro', curr: -dre.impostos, prev: -prevDre.impostos, bold: false },
                  { label: '= Lucro Líquido', curr: dre.lucroLiquido, prev: prevDre.lucroLiquido, bold: true },
                ].map((row, i) => {
                  const v = fmtVar(row.curr, row.prev)
                  return (
                    <tr key={i} className={`hover:bg-gray-50 ${row.bold ? 'bg-blue-50/30' : ''}`}>
                      <td className={`px-4 py-2.5 text-gray-700 ${row.bold ? 'font-bold' : ''}`}>{row.label}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${row.bold ? 'font-bold' : ''} ${row.curr >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {fmtBRL(row.curr)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-gray-400 ${row.bold ? 'font-semibold' : ''}`}>
                        {fmtBRL(row.prev)}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs font-semibold ${v.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {v.label}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DrillDownModal
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        title={drillTitle}
        entries={drillEntries}
        chartAccounts={chartAccounts}
      />
    </div>
  )
}
