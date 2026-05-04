import { useEffect, useMemo, useState } from 'react'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import { calculateDRE, ifrsDREToLegacy } from '../services/financeCalculations'
import { calculateIFRSDRE } from '../services/ifrsEngine'
import { getChartAccounts, getFinancialEntries } from '../services/financeApi'
import { getCorporateChart } from '../services/corporateChartApi'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import { simulationChartAccounts, simulationFinancialEntries } from '../data/simulationData'
import { useSimulation } from '../../../contexts/SimulationContext'
import EmptyFinancialState from './EmptyFinancialState'
import { buildScenarios } from '../services/sensitivityAnalysis'
import type { DREBase } from '../services/sensitivityAnalysis'
import { fmtBRL } from '../../../lib/currency'
import type { ChartAccount, FinancialEntry, DateRange } from '../types/finance.types'

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

function fmtPct(v: number): string {
  return v.toFixed(1) + '%'
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-semibold text-blue-600">±{Math.abs(value)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={50}
        step={1}
        value={Math.abs(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-blue-600"
      />
    </div>
  )
}

interface ScenarioColumnProps {
  label: string
  color: string
  data: {
    receitaLiquida: number
    ebitda: number
    lucroLiquido: number
    margemBruta: number
    margemEbitda: number
    margemLiquida: number
  }
  isBase?: boolean
}

function ScenarioColumn({ label, color, data, isBase }: ScenarioColumnProps) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isBase ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</div>
      <div className="space-y-2">
        <div>
          <div className="text-xs text-gray-500">Receita Líquida</div>
          <div className={`text-sm font-bold font-mono ${data.receitaLiquida >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {fmtBRL(data.receitaLiquida)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">EBITDA</div>
          <div className={`text-sm font-bold font-mono ${data.ebitda >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtBRL(data.ebitda)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Lucro Líquido</div>
          <div className={`text-sm font-bold font-mono ${data.lucroLiquido >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {fmtBRL(data.lucroLiquido)}
          </div>
        </div>
        <hr className="border-gray-100" />
        <div>
          <div className="text-xs text-gray-500">Mg. Bruta</div>
          <div className="text-xs font-semibold text-gray-700">{fmtPct(data.margemBruta)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Mg. EBITDA</div>
          <div className="text-xs font-semibold text-gray-700">{fmtPct(data.margemEbitda)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Mg. Líquida</div>
          <div className="text-xs font-semibold text-gray-700">{fmtPct(data.margemLiquida)}</div>
        </div>
      </div>
    </div>
  )
}

export default function SensitivityScreen({
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
  const [error, setError] = useState<string | null>(null)

  const [receitaVar, setReceitaVar] = useState(20)
  const [custosVar, setCustosVar] = useState(10)
  const [despesasVar, setDespesasVar] = useState(10)
  const [impostosVar, setImpostosVar] = useState(5)

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
          setChartAccountsV2([])
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
        setEntries(entriesData)
        setChartAccounts(accountsData)
        setChartAccountsV2(accountsV2Data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
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

  const dreBase: DREBase = useMemo(() => ({
    receitaBruta: baseDRE.receitaBruta,
    receitaLiquida: baseDRE.receitaLiquida,
    deducoes: baseDRE.deducoes,
    cmv: baseDRE.cmv,
    lucroBruto: baseDRE.lucroBruto,
    despesasOperacionais: baseDRE.totalDespesasOperacionais,
    ebitda: baseDRE.ebitda,
    depreciacao: baseDRE.depreciacao,
    ebit: baseDRE.ebit,
    resultadoFinanceiro: baseDRE.resultadoFinanceiro,
    impostos: baseDRE.impostos,
    lucroLiquido: baseDRE.lucroLiquido,
  }), [baseDRE])

  const { pessimista, base, otimista } = useMemo(() =>
    buildScenarios(dreBase, {
      receitaVariation: receitaVar,
      custosVariation: custosVar,
      despesasVariation: despesasVar,
      impostosVariation: impostosVar,
    }),
    [dreBase, receitaVar, custosVar, despesasVar, impostosVar]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const headerBlock = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Análise de Sensibilidade</h1>
        <p className="text-sm text-gray-500">Cenários Pessimista / Base / Otimista</p>
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

      {/* Sliders de ajuste */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Ajuste dos Cenários</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderRow label="Variação de Receita" value={receitaVar} onChange={setReceitaVar} />
          <SliderRow label="Variação de Custos (CPV)" value={custosVar} onChange={setCustosVar} />
          <SliderRow label="Variação de Despesas" value={despesasVar} onChange={setDespesasVar} />
          <SliderRow label="Variação de Impostos" value={impostosVar} onChange={setImpostosVar} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Pessimista = receita cai, custos sobem. Otimista = receita sobe, custos caem.
        </p>
      </div>

      {/* 3 colunas de cenários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScenarioColumn
          label="Pessimista"
          color="text-red-600"
          data={pessimista}
        />
        <ScenarioColumn
          label="Base (Atual)"
          color="text-blue-600"
          data={base}
          isBase
        />
        <ScenarioColumn
          label="Otimista"
          color="text-emerald-600"
          data={otimista}
        />
      </div>

      {/* Tabela comparativa */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 overflow-x-auto">
        <h3 className="font-semibold text-gray-900 mb-4">Comparativo de Resultados</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Indicador</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase">Pessimista</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-blue-500 uppercase">Base</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-500 uppercase">Otimista</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { label: 'Receita Líquida', p: pessimista.receitaLiquida, b: base.receitaLiquida, o: otimista.receitaLiquida, fmt: fmtBRL },
              { label: 'EBITDA', p: pessimista.ebitda, b: base.ebitda, o: otimista.ebitda, fmt: fmtBRL },
              { label: 'Lucro Líquido', p: pessimista.lucroLiquido, b: base.lucroLiquido, o: otimista.lucroLiquido, fmt: fmtBRL },
              { label: 'Margem Bruta', p: pessimista.margemBruta, b: base.margemBruta, o: otimista.margemBruta, fmt: fmtPct },
              { label: 'Margem EBITDA', p: pessimista.margemEbitda, b: base.margemEbitda, o: otimista.margemEbitda, fmt: fmtPct },
              { label: 'Margem Líquida', p: pessimista.margemLiquida, b: base.margemLiquida, o: otimista.margemLiquida, fmt: fmtPct },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                <td className={`px-4 py-2.5 text-right font-mono text-sm ${row.p >= 0 ? 'text-red-600' : 'text-red-700'}`}>
                  {row.fmt(row.p)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-gray-900">
                  {row.fmt(row.b)}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono text-sm ${row.o >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {row.fmt(row.o)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
