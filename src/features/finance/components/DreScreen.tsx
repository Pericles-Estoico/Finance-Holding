import { useEffect, useMemo, useState } from 'react'
import FinancialKpiCard from './FinancialKpiCard'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import DreTable from './DreTable'
import DrillDownModal from './DrillDownModal'
import { calculateDRE } from '../services/financeCalculations'
import { getChartAccounts, getFinancialEntries } from '../services/financeApi'
import {
  mockChartAccounts,
  mockFinancialEntries,
} from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
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

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillEntries, setDrillEntries] = useState<FinancialEntry[]>([])

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
        const [accountsData, entriesData] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
        ])
        if (cancelled) return
        if (entriesData.length === 0 || accountsData.length === 0) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
        } else {
          setEntries(entriesData)
          setChartAccounts(accountsData)
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

  const period = useMemo<DateRange>(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate]
  )

  const dre = useMemo(
    () => calculateDRE(entries, chartAccounts, period),
    [entries, chartAccounts, period]
  )

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
            Demonstrativo de Resultado por regime de competencia
          </p>
        </div>
        {onPeriodChange && (
          <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
        )}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {error} - exibindo dados de demonstracao.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FinancialKpiCard
          title="Receita Liquida"
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
          title="Lucro Liquido"
          value={fmtBRL(dre.lucroLiquido)}
          subtitle="Resultado final"
          variant={dre.lucroLiquido >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Margem Liquida"
          value={fmtPct(dre.margemLiquida)}
          subtitle="Lucro / Rec. liquida"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">DRE Detalhada</h3>
            <p className="text-xs text-gray-500">
              Clique em uma linha para ver os lancamentos
            </p>
          </div>
          <span className="text-xs text-gray-400">
            Regime: <span className="font-semibold text-gray-600">Competencia</span>
          </span>
        </div>
        <DreTable dre={dre} onDrillDown={handleDrillDown} />
      </div>

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
