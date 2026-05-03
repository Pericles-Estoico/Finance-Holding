import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { calculateIFRSDRE, calcIFRSKPIs } from '../services/ifrsEngine'
import { ifrsDREToLegacy } from '../services/financeCalculations'
import { getCorporateChart } from '../services/corporateChartApi'
import { getFinancialEntries } from '../services/financeApi'
import { mockFinancialEntries } from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
import { useCompany } from '../../../contexts/CompanyContext'
import { exportExecutiveSummaryPDF } from '../services/pdfExport'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import { fmtBRL } from '../../../lib/currency'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import type { FinancialEntry, DateRange } from '../types/finance.types'

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(1) + '%'
}

function fmtPeriodLabel(from: string, to: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return `${fmt(from)} a ${fmt(to)}`
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

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>
  const positive = value >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

export default function ExecutiveSummaryScreen({
  companyId, startDate, endDate, onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()
  const { activeCompany } = useCompany()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [v2Accounts, setV2Accounts] = useState<ChartAccountV2[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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

  const ifrsDRE = useMemo(() =>
    useIFRS ? calculateIFRSDRE(entries, v2Accounts, period) : null,
    [entries, v2Accounts, period, useIFRS])

  const ifrsPreDRE = useMemo(() =>
    useIFRS ? calculateIFRSDRE(entries, v2Accounts, prevPeriod) : null,
    [entries, v2Accounts, prevPeriod, useIFRS])

  const dre = useMemo(() =>
    ifrsDRE ? ifrsDREToLegacy(ifrsDRE) : null,
    [ifrsDRE])

  const kpisRaw = useMemo(() => {
    if (!ifrsDRE) return null
    return calcIFRSKPIs(ifrsDRE, { periodoAnterior: ifrsPreDRE ?? undefined })
  }, [ifrsDRE, ifrsPreDRE])

  const kpis = kpisRaw ? {
    margemBruta:        kpisRaw.margemBruta.toNumber(),
    margemOperacional:  kpisRaw.margemOperacional.toNumber(),
    margemEBITDA:       kpisRaw.margemEBITDA.toNumber(),
    margemLiquida:      kpisRaw.margemLiquida.toNumber(),
    crescimentoReceita: kpisRaw.crescimentoReceita?.toNumber() ?? null,
    crescimentoEBITDA:  kpisRaw.crescimentoEBITDA?.toNumber() ?? null,
  } : null

  // Fallback: margens da DRE legada
  const margins = kpis ?? (dre ? {
    margemBruta:        dre.margemBruta,
    margemOperacional:  dre.margemEbitda - (dre.depreciacao / (dre.receitaLiquida || 1)) * 100,
    margemEBITDA:       dre.margemEbitda,
    margemLiquida:      dre.margemLiquida,
    crescimentoReceita: null,
    crescimentoEBITDA:  null,
  } : null)

  function handleExport() {
    if (!dre || !margins) return
    setExporting(true)
    try {
      exportExecutiveSummaryPDF({
        companyName: activeCompany?.name ?? 'Empresa',
        period,
        receitaLiquida:    dre.receitaLiquida,
        lucroBruto:        dre.lucroBruto,
        ebitda:            dre.ebitda,
        lucroLiquido:      dre.lucroLiquido,
        margemBruta:       margins.margemBruta,
        margemEBITDA:      margins.margemEBITDA,
        margemLiquida:     margins.margemLiquida,
        margemOperacional: margins.margemOperacional,
        crescimentoReceita:  margins.crescimentoReceita,
        crescimentoEBITDA:   margins.crescimentoEBITDA,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasData = !!dre

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Summary</h1>
          <p className="text-sm text-gray-500">Relatório Nível 1 — pronto para apresentar a investidores</p>
        </div>
        <div className="flex items-center gap-2">
          {onPeriodChange && <FinancialPeriodFilter value={period} onChange={onPeriodChange} />}
          <button
            onClick={handleExport}
            disabled={!hasData || exporting}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Gerando…' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhum dado financeiro para o período.</p>
        </div>
      ) : (
        <>
          {/* Preview da 1ª página */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Cabeçalho do doc */}
            <div className="bg-slate-900 text-white px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Executive Summary</p>
                  <h2 className="text-xl font-bold">{activeCompany?.name ?? 'Empresa'}</h2>
                  <p className="text-slate-400 text-sm mt-0.5">{fmtPeriodLabel(period.from, period.to)}</p>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Confidencial</span>
              </div>
            </div>

            {/* 4 KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
              {[
                { label: 'Receita Líquida', value: fmtBRL(dre.receitaLiquida), sub: null },
                { label: 'EBITDA',          value: fmtBRL(dre.ebitda),          sub: fmtPct(margins?.margemEBITDA ?? null) + ' margem' },
                { label: 'Lucro Líquido',   value: fmtBRL(dre.lucroLiquido),    sub: fmtPct(margins?.margemLiquida ?? null) + ' margem' },
                { label: 'Lucro Bruto',     value: fmtBRL(dre.lucroBruto),      sub: fmtPct(margins?.margemBruta ?? null) + ' margem' },
              ].map(item => (
                <div key={item.label} className="bg-white px-5 py-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{item.value}</p>
                  {item.sub && <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>

            {/* DRE resumida */}
            <div className="px-6 py-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">DRE Resumida</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase pb-2">Linha</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase pb-2">Valor</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase pb-2">% Rec. Líq.</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase pb-2">YoY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label: 'Receita Líquida', value: dre.receitaLiquida, pct: 100,                                     yoy: margins?.crescimentoReceita ?? null, bold: true },
                    { label: 'Lucro Bruto',     value: dre.lucroBruto,     pct: margins?.margemBruta ?? null,            yoy: null,                                bold: true },
                    { label: 'EBITDA',          value: dre.ebitda,         pct: margins?.margemEBITDA ?? null,           yoy: margins?.crescimentoEBITDA ?? null,   bold: true },
                    { label: 'EBIT',            value: dre.ebit,           pct: margins?.margemOperacional ?? null,      yoy: null,                                bold: false },
                    { label: 'Lucro Líquido',   value: dre.lucroLiquido,   pct: margins?.margemLiquida ?? null,          yoy: null,                                bold: true },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-slate-50/50">
                      <td className={`py-2 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{row.label}</td>
                      <td className={`py-2 text-right font-mono tabular-nums ${row.bold ? 'font-semibold' : ''} ${row.value < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {fmtBRL(row.value)}
                      </td>
                      <td className="py-2 text-right text-slate-400 text-xs tabular-nums">{fmtPct(row.pct)}</td>
                      <td className="py-2 text-right"><Trend value={row.yoy} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Benchmarks */}
            <div className="px-6 py-5 border-t border-gray-100 bg-slate-50/40">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">vs Benchmark Setor (confecção/varejo)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Margem Bruta',     atual: margins?.margemBruta ?? null,       meta: 55 },
                  { label: 'Margem EBITDA',    atual: margins?.margemEBITDA ?? null,      meta: 20 },
                  { label: 'Margem Operac.',   atual: margins?.margemOperacional ?? null, meta: 15 },
                  { label: 'Margem Líquida',   atual: margins?.margemLiquida ?? null,     meta: 18 },
                ].map(item => {
                  const ok = item.atual !== null && item.atual >= item.meta
                  return (
                    <div key={item.label} className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className={`font-bold text-base tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(item.atual)}
                        </span>
                        <span className="text-xs text-slate-400">/ meta {item.meta}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-6 py-3 border-t border-gray-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
              <span>Finance Holding · financedre.com.br</span>
              <span>Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
