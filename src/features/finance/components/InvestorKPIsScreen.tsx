import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp,
} from 'lucide-react'
import { calculateIFRSDRE, calcIFRSKPIs } from '../services/ifrsEngine'
import { ifrsDREToLegacy } from '../services/financeCalculations'
import { getCorporateChart } from '../services/corporateChartApi'
import { getFinancialEntries } from '../services/financeApi'
import { mockFinancialEntries } from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import {
  SECTOR_BENCHMARKS, getBenchmarkStatus,
} from '../data/sectorBenchmarks'
import type { BenchmarkStatus } from '../data/sectorBenchmarks'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import type { FinancialEntry, DateRange } from '../types/finance.types'

// ──────────────────────────────────────────────────────────────────────
// Helpers de formatação
// ──────────────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return (v >= 0 ? '' : '') + v.toFixed(1) + '%'
}

function fmtChange(v: number | null): { label: string; positive: boolean } | null {
  if (v === null) return null
  return { label: (v >= 0 ? '+' : '') + v.toFixed(1) + '%', positive: v >= 0 }
}

function getPreviousPeriod(period: DateRange): DateRange {
  const s = new Date(period.from)
  const e = new Date(period.to)
  const diffMs = e.getTime() - s.getTime()
  const prevEnd = new Date(s)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return {
    from: prevStart.toISOString().split('T')[0],
    to: prevEnd.toISOString().split('T')[0],
  }
}

// ──────────────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────────────

const STATUS_BG: Record<BenchmarkStatus, string> = {
  green:   'bg-emerald-50 border-emerald-200',
  yellow:  'bg-amber-50 border-amber-200',
  red:     'bg-red-50 border-red-200',
  neutral: 'bg-gray-50 border-gray-200',
}
const STATUS_VALUE: Record<BenchmarkStatus, string> = {
  green:   'text-emerald-700',
  yellow:  'text-amber-700',
  red:     'text-red-600',
  neutral: 'text-gray-500',
}
const STATUS_DOT: Record<BenchmarkStatus, string> = {
  green:   'bg-emerald-500',
  yellow:  'bg-amber-400',
  red:     'bg-red-500',
  neutral: 'bg-gray-300',
}

interface KPICardProps {
  label: string
  value: number | null
  benchmark: number
  unit: string
  description: string
  status: BenchmarkStatus
  change: { label: string; positive: boolean } | null
  missing?: string
}

function KPICard({ label, value, benchmark, unit, description, status, change, missing }: KPICardProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${STATUS_BG[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
          <span className="text-xs font-semibold text-slate-600">{label}</span>
        </div>
        <button
          onClick={() => setShowInfo(v => !v)}
          className="text-slate-300 hover:text-slate-500 transition-colors"
        >
          {showInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className={`text-2xl font-bold tabular-nums ${STATUS_VALUE[status]}`}>
        {missing ? <span className="text-sm font-normal text-slate-400 italic">{missing}</span> : fmtPct(value)}
      </div>

      {!missing && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Meta: <span className="font-semibold text-slate-600">{benchmark}{unit}</span></span>
          {change && (
            <span className={`flex items-center gap-0.5 font-semibold ${change.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {change.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change.label} YoY
            </span>
          )}
          {!change && <span className="flex items-center gap-0.5 text-slate-300"><Minus className="w-3 h-3" /> YoY</span>}
        </div>
      )}

      {showInfo && (
        <p className="text-xs text-slate-500 border-t border-current/10 pt-2 mt-1">{description}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Tela principal
// ──────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

export default function InvestorKPIsScreen({
  companyId, startDate, endDate, onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [v2Accounts, setV2Accounts] = useState<ChartAccountV2[]>([])
  const [loading, setLoading] = useState(true)

  // Inputs manuais para ROE/ROA
  const [patrimonioLiquido, setPatrimonioLiquido] = useState<string>('')
  const [ativoTotal, setAtivoTotal] = useState<string>('')
  const [showInputs, setShowInputs] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (isSimulation || !companyId || companyId === 'consolidated') {
        if (!cancelled) { setEntries(mockFinancialEntries); setLoading(false) }
        return
      }
      try {
        const [entriesData, accountsData] = await Promise.all([
          getFinancialEntries(companyId),
          getCorporateChart(companyId).catch(() => [] as ChartAccountV2[]),
        ])
        if (!cancelled) {
          setEntries(entriesData.length ? entriesData : mockFinancialEntries)
          setV2Accounts(accountsData)
        }
      } catch {
        if (!cancelled) setEntries(mockFinancialEntries)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [companyId, isSimulation])

  const period = useMemo<DateRange>(() => ({ from: startDate, to: endDate }), [startDate, endDate])
  const prevPeriod = useMemo(() => getPreviousPeriod(period), [period])

  const useIFRS = v2Accounts.length > 0

  const dre = useMemo(() => {
    if (useIFRS) return ifrsDREToLegacy(calculateIFRSDRE(entries, v2Accounts, period))
    return null
  }, [entries, v2Accounts, period, useIFRS])

  const prevDre = useMemo(() => {
    if (useIFRS) return ifrsDREToLegacy(calculateIFRSDRE(entries, v2Accounts, prevPeriod))
    return null
  }, [entries, v2Accounts, prevPeriod, useIFRS])

  // Calcular KPIs via calcIFRSKPIs (requer IFRSDREResult com Decimal)
  const ifrsDRE = useMemo(() => {
    if (!useIFRS) return null
    return calculateIFRSDRE(entries, v2Accounts, period)
  }, [entries, v2Accounts, period, useIFRS])

  const ifrsPreDRE = useMemo(() => {
    if (!useIFRS) return null
    return calculateIFRSDRE(entries, v2Accounts, prevPeriod)
  }, [entries, v2Accounts, prevPeriod, useIFRS])

  const plNum = parseFloat(patrimonioLiquido.replace(',', '.')) || undefined
  const atNum = parseFloat(ativoTotal.replace(',', '.')) || undefined

  const kpis = useMemo(() => {
    if (!ifrsDRE) return null
    return calcIFRSKPIs(ifrsDRE, {
      patrimonioLiquido: plNum,
      ativoTotal: atNum,
      periodoAnterior: ifrsPreDRE ?? undefined,
    })
  }, [ifrsDRE, ifrsPreDRE, plNum, atNum])

  // Fallback: KPIs da DRE legada
  const legacyKpis = useMemo(() => {
    if (!dre) return null
    const prev = prevDre
    const yoyReceita = prev && prev.receitaLiquida > 0
      ? ((dre.receitaLiquida - prev.receitaLiquida) / Math.abs(prev.receitaLiquida)) * 100
      : null
    const yoyEbitda = prev && prev.ebitda > 0
      ? ((dre.ebitda - prev.ebitda) / Math.abs(prev.ebitda)) * 100
      : null
    return {
      margemBruta: dre.margemBruta,
      margemOperacional: dre.margemEbitda - (dre.depreciacao / (dre.receitaLiquida || 1)) * 100,
      margemEBITDA: dre.margemEbitda,
      margemLiquida: dre.margemLiquida,
      roe: plNum ? (dre.lucroLiquido / plNum) * 100 : null,
      roa: atNum ? (dre.lucroLiquido / atNum) * 100 : null,
      crescimentoReceita: yoyReceita,
      crescimentoEBITDA: yoyEbitda,
    }
  }, [dre, prevDre, plNum, atNum])

  const k = kpis
    ? {
        margemBruta: kpis.margemBruta.toNumber(),
        margemOperacional: kpis.margemOperacional.toNumber(),
        margemEBITDA: kpis.margemEBITDA.toNumber(),
        margemLiquida: kpis.margemLiquida.toNumber(),
        roe: kpis.roe?.toNumber() ?? null,
        roa: kpis.roa?.toNumber() ?? null,
        crescimentoReceita: kpis.crescimentoReceita?.toNumber() ?? null,
        crescimentoEBITDA: kpis.crescimentoEBITDA?.toNumber() ?? null,
      }
    : legacyKpis

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bm = SECTOR_BENCHMARKS

  const cards = k ? [
    {
      key: 'margemBruta',
      label: bm.margemBruta.label,
      value: k.margemBruta,
      benchmark: bm.margemBruta.target,
      unit: bm.margemBruta.unit,
      description: bm.margemBruta.description,
      status: getBenchmarkStatus(k.margemBruta, bm.margemBruta),
      change: null,
    },
    {
      key: 'margemOperacional',
      label: bm.margemOperacional.label,
      value: k.margemOperacional,
      benchmark: bm.margemOperacional.target,
      unit: bm.margemOperacional.unit,
      description: bm.margemOperacional.description,
      status: getBenchmarkStatus(k.margemOperacional, bm.margemOperacional),
      change: null,
    },
    {
      key: 'margemEBITDA',
      label: bm.margemEBITDA.label,
      value: k.margemEBITDA,
      benchmark: bm.margemEBITDA.target,
      unit: bm.margemEBITDA.unit,
      description: bm.margemEBITDA.description,
      status: getBenchmarkStatus(k.margemEBITDA, bm.margemEBITDA),
      change: fmtChange(k.crescimentoEBITDA),
    },
    {
      key: 'margemLiquida',
      label: bm.margemLiquida.label,
      value: k.margemLiquida,
      benchmark: bm.margemLiquida.target,
      unit: bm.margemLiquida.unit,
      description: bm.margemLiquida.description,
      status: getBenchmarkStatus(k.margemLiquida, bm.margemLiquida),
      change: null,
    },
    {
      key: 'roe',
      label: bm.roe.label,
      value: k.roe,
      benchmark: bm.roe.target,
      unit: bm.roe.unit,
      description: bm.roe.description,
      status: getBenchmarkStatus(k.roe, bm.roe),
      change: null,
      missing: k.roe === null ? 'Informe o PL abaixo' : undefined,
    },
    {
      key: 'roa',
      label: bm.roa.label,
      value: k.roa,
      benchmark: bm.roa.target,
      unit: bm.roa.unit,
      description: bm.roa.description,
      status: getBenchmarkStatus(k.roa, bm.roa),
      change: null,
      missing: k.roa === null ? 'Informe o Ativo abaixo' : undefined,
    },
    {
      key: 'crescimentoReceita',
      label: bm.crescimentoReceita.label,
      value: k.crescimentoReceita,
      benchmark: bm.crescimentoReceita.target,
      unit: bm.crescimentoReceita.unit,
      description: bm.crescimentoReceita.description,
      status: getBenchmarkStatus(k.crescimentoReceita, bm.crescimentoReceita),
      change: fmtChange(k.crescimentoReceita),
      missing: k.crescimentoReceita === null ? 'Sem dados do período anterior' : undefined,
    },
    {
      key: 'crescimentoEBITDA',
      label: bm.crescimentoEBITDA.label,
      value: k.crescimentoEBITDA,
      benchmark: bm.crescimentoEBITDA.target,
      unit: bm.crescimentoEBITDA.unit,
      description: bm.crescimentoEBITDA.description,
      status: getBenchmarkStatus(k.crescimentoEBITDA, bm.crescimentoEBITDA),
      change: fmtChange(k.crescimentoEBITDA),
      missing: k.crescimentoEBITDA === null ? 'Sem dados do período anterior' : undefined,
    },
  ] : []

  const greenCount = cards.filter(c => c.status === 'green').length
  const redCount = cards.filter(c => c.status === 'red').length

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPIs para Investidores</h1>
          <p className="text-sm text-gray-500">
            Benchmarks do setor confecção/varejo · SEBRAE + Abravest 2024
          </p>
        </div>
        {onPeriodChange && (
          <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
        )}
      </div>

      {/* Placar */}
      {cards.length > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm">
          <span className="text-slate-500">Desempenho vs benchmark:</span>
          <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />{greenCount} acima
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1.5 font-semibold text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />{redCount} abaixo
          </span>
        </div>
      )}

      {/* Grid de KPIs */}
      {cards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-slate-400 text-sm">Nenhum dado disponível para o período selecionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(card => (
            <KPICard key={card.key} {...card} />
          ))}
        </div>
      )}

      {/* Inputs manuais para ROE/ROA */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowInputs(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-sm"
        >
          <span className="font-semibold text-slate-700">Dados do Balanço Patrimonial (para ROE e ROA)</span>
          {showInputs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showInputs && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Patrimônio Líquido (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={patrimonioLiquido}
                onChange={e => setPatrimonioLiquido(e.target.value)}
                placeholder="Ex: 500000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Ativo Total (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={ativoTotal}
                onChange={e => setAtivoTotal(e.target.value)}
                placeholder="Ex: 1200000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="col-span-2 text-xs text-slate-400">
              Estes valores são usados apenas para calcular ROE e ROA. O Balanço Patrimonial completo será disponibilizado no Epic 4.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
