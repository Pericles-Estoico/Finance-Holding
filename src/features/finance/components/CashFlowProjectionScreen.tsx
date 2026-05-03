import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import { calculateDRE, ifrsDREToLegacy } from '../services/financeCalculations'
import { calculateIFRSDRE } from '../services/ifrsEngine'
import { getChartAccounts, getFinancialEntries } from '../services/financeApi'
import { getCorporateChart } from '../services/corporateChartApi'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import { mockChartAccounts, mockFinancialEntries } from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
import { fmtBRL } from '../../../lib/currency'
import type { ChartAccount, FinancialEntry, DateRange } from '../types/finance.types'

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

interface ProjectionYear {
  year: string
  receita: number
  ebitda: number
  margemEbitda: number
}

function buildProjection(
  baseReceita: number,
  baseEbitda: number,
  cagrReceita: number,
  cagrEbitda: number,
  years: number,
  baseYear: number
): ProjectionYear[] {
  return Array.from({ length: years }, (_, i) => {
    const yr = baseYear + i + 1
    const receita = baseReceita * Math.pow(1 + cagrReceita / 100, i + 1)
    const ebitda = baseEbitda * Math.pow(1 + cagrEbitda / 100, i + 1)
    const margemEbitda = receita !== 0 ? (ebitda / receita) * 100 : 0
    return { year: String(yr), receita, ebitda, margemEbitda }
  })
}

function fmtPct(v: number): string {
  return v.toFixed(1) + '%'
}

function fmtM(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`
  return fmtBRL(v)
}

export default function CashFlowProjectionScreen({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [chartAccountsV2, setChartAccountsV2] = useState<ChartAccountV2[]>([])
  const [loading, setLoading] = useState(true)

  const [cagrReceita, setCagrReceita] = useState(20)
  const [cagrEbitda, setCagrEbitda] = useState(25)
  const [years, setYears] = useState<3 | 5>(5)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (isSimulation || !companyId || companyId === 'consolidated') {
        if (!cancelled) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
          setLoading(false)
        }
        return
      }
      try {
        const [accountsData, entriesData, accountsV2Data] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
          getCorporateChart(companyId).catch(() => [] as ChartAccountV2[]),
        ])
        if (cancelled) return
        if (entriesData.length === 0 || accountsData.length === 0) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
        } else {
          setEntries(entriesData)
          setChartAccounts(accountsData)
          setChartAccountsV2(accountsV2Data)
        }
      } catch {
        if (!cancelled) {
          setEntries(mockFinancialEntries)
          setChartAccounts(mockChartAccounts)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [companyId, isSimulation])

  const period = useMemo<DateRange>(() => ({ from: startDate, to: endDate }), [startDate, endDate])

  const useIFRS = chartAccountsV2.length > 0

  const baseDRE = useMemo(() => {
    return useIFRS
      ? ifrsDREToLegacy(calculateIFRSDRE(entries, chartAccountsV2, period))
      : calculateDRE(entries, chartAccounts, period)
  }, [entries, chartAccounts, chartAccountsV2, period, useIFRS])

  const baseYear = useMemo(() => new Date(startDate).getFullYear(), [startDate])

  const projection = useMemo(() =>
    buildProjection(
      baseDRE.receitaLiquida,
      baseDRE.ebitda,
      cagrReceita,
      cagrEbitda,
      years,
      baseYear
    ),
    [baseDRE, cagrReceita, cagrEbitda, years, baseYear]
  )

  const chartData = useMemo(() => [
    {
      year: String(baseYear) + ' (base)',
      receita: baseDRE.receitaLiquida,
      ebitda: baseDRE.ebitda,
    },
    ...projection.map((p) => ({ year: p.year, receita: p.receita, ebitda: p.ebitda })),
  ], [baseDRE, projection, baseYear])

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
          <h1 className="text-2xl font-bold text-gray-900">Projeção de Fluxo de Caixa</h1>
          <p className="text-sm text-gray-500">Estimativa {years} anos — base para valuation DCF</p>
        </div>
        {onPeriodChange && (
          <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
        )}
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Horizonte:</span>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {([3, 5] as const).map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${years === y ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  {y} anos
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-[160px] space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>CAGR Receita</span>
              <span className="font-semibold text-blue-600">{cagrReceita}% a.a.</span>
            </div>
            <input
              type="range" min={1} max={50} step={1} value={cagrReceita}
              onChange={(e) => setCagrReceita(Number(e.target.value))}
              className="w-full h-1.5 accent-blue-600"
            />
          </div>

          <div className="flex-1 min-w-[160px] space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>CAGR EBITDA</span>
              <span className="font-semibold text-emerald-600">{cagrEbitda}% a.a.</span>
            </div>
            <input
              type="range" min={1} max={50} step={1} value={cagrEbitda}
              onChange={(e) => setCagrEbitda(Number(e.target.value))}
              className="w-full h-1.5 accent-emerald-600"
            />
          </div>
        </div>
        <p className="text-xs text-amber-600 mt-3">
          ⚠ Projeções são estimativas baseadas em crescimento constante (CAGR). Não constituem garantia de resultados.
        </p>
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Evolução Projetada</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} width={70} />
            <Tooltip
              formatter={(value: number, name: string) => [
                fmtBRL(value),
                name === 'receita' ? 'Receita Líquida' : 'EBITDA',
              ]}
            />
            <Legend
              formatter={(value) => value === 'receita' ? 'Receita Líquida' : 'EBITDA'}
            />
            <Bar dataKey="receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ebitda" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 overflow-x-auto">
        <h3 className="font-semibold text-gray-900 mb-4">Tabela de Projeção</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ano</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Receita Líquida</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">EBITDA</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mg. EBITDA</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CAGR Rec.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Linha base */}
            <tr className="bg-blue-50/40">
              <td className="px-4 py-2.5 font-bold text-blue-700">{baseYear} (base)</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900">{fmtBRL(baseDRE.receitaLiquida)}</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900">{fmtBRL(baseDRE.ebitda)}</td>
              <td className="px-4 py-2.5 text-right text-gray-600">{fmtPct(baseDRE.margemEbitda)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">—</td>
            </tr>
            {projection.map((row, i) => (
              <tr key={row.year} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-700">{row.year}</td>
                <td className="px-4 py-2.5 text-right font-mono text-blue-700">{fmtBRL(row.receita)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{fmtBRL(row.ebitda)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{fmtPct(row.margemEbitda)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold text-blue-500">+{cagrReceita}% a.a.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
