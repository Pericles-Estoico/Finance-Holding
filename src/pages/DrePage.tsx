import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions } from '../lib/api/transactions'
import { getAccounts } from '../lib/api/accounts'
import { calcDRE, formatBRL, formatPercent } from '../lib/dre'
import type { DREResult, DRELine } from '../lib/dre'
import type { Transaction } from '../types'

// Benchmarks do setor (PRD §5)
const BENCHMARK = { margemBruta: { min: 55, max: 70 }, margemLiquida: { min: 18, max: 26 } }

type Period = 'mes_atual' | 'trimestre' | 'ano_atual' | 'custom'
const PERIOD_LABELS: Record<Period, string> = {
  mes_atual: 'Este mês',
  trimestre: 'Este trimestre',
  ano_atual: 'Este ano',
  custom: 'Personalizado',
}

function getPeriodDates(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === 'mes_atual') return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-31` }
  if (period === 'trimestre') {
    const q = Math.floor(m / 3)
    return { from: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, to: `${y}-${String(q * 3 + 3).padStart(2, '0')}-30` }
  }
  if (period === 'ano_atual') return { from: `${y}-01-01`, to: `${y}-12-31` }
  return { from: customFrom, to: customTo }
}

function Semaphore({ value, bench }: { value: number; bench: { min: number; max: number } }) {
  if (value >= bench.min) return <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><TrendingUp className="w-3 h-3" />{formatPercent(value)}</span>
  if (value >= bench.min * 0.8) return <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium"><Minus className="w-3 h-3" />{formatPercent(value)}</span>
  return <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"><TrendingDown className="w-3 h-3" />{formatPercent(value)}</span>
}

function DRERow({ line, expanded, onToggle, refRevenue }: {
  line: DRELine
  expanded: boolean
  onToggle: () => void
  refRevenue: number
}) {
  const hasChildren = (line.children?.length ?? 0) > 0
  const isNegative = line.amountCents < 0
  const amountColor = line.isTotal
    ? (line.amountCents >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold')
    : line.isSubtotal
    ? (line.amountCents >= 0 ? 'text-blue-700 font-semibold' : 'text-red-500 font-semibold')
    : isNegative ? 'text-red-500' : 'text-gray-700'

  return (
    <>
      <tr
        className={`border-b border-gray-50 transition-colors ${hasChildren ? 'cursor-pointer hover:bg-gray-50' : ''} ${line.isTotal ? 'bg-slate-50' : line.isSubtotal ? 'bg-blue-50/40' : ''}`}
        onClick={hasChildren ? onToggle : undefined}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {hasChildren
              ? (expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />)
              : <span className="w-3.5 shrink-0" />}
            <span className={`text-sm ${line.isTotal ? 'font-bold text-gray-900' : line.isSubtotal ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
              {line.label}
            </span>
          </div>
        </td>
        <td className={`px-4 py-2.5 text-right text-sm whitespace-nowrap ${amountColor}`}>
          {formatBRL(line.amountCents)}
        </td>
        <td className="px-4 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
          {formatPercent(calcPercent(line.amountCents, refRevenue))}
        </td>
        <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap">
          {line.code === 'LB' && <Semaphore value={line.percentOfRevenue} bench={BENCHMARK.margemBruta} />}
          {line.code === 'LL' && <Semaphore value={line.percentOfRevenue} bench={BENCHMARK.margemLiquida} />}
        </td>
      </tr>
      {hasChildren && expanded && line.children!.map(child => (
        <tr key={child.code} className="border-b border-gray-50 bg-gray-50/50">
          <td className="px-4 py-2 pl-12">
            <span className="text-xs text-gray-500">{child.code} — {child.label}</span>
          </td>
          <td className="px-4 py-2 text-right text-xs text-gray-500 whitespace-nowrap">{formatBRL(child.amountCents)}</td>
          <td className="px-4 py-2 text-right text-xs text-gray-400 whitespace-nowrap">{formatPercent(calcPercent(child.amountCents, refRevenue))}</td>
          <td />
        </tr>
      ))}
    </>
  )
}

function calcPercent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 10000) / 100
}

export default function DrePage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  const [period, setPeriod] = useState<Period>('mes_atual')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dre, setDre] = useState<DREResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1', '2', '3', '4']))

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : activeCompanyId ? [activeCompanyId] : []

  useEffect(() => {
    if (companyIds.length > 0) loadData()
  }, [activeCompanyId, period, customFrom, customTo, isSimulation])

  const loadData = async () => {
    if (!companyIds.length) return
    setLoading(true)
    try {
      const { from, to } = getPeriodDates(period, customFrom, customTo)

      const [txs, accs] = await Promise.all([
        getTransactions({ companyIds, isSimulation, dateFrom: from, dateTo: to }),
        Promise.all(companyIds.map(id => getAccounts(id))).then(r => r.flat()),
      ])

      setTransactions(txs)
      const result = calcDRE(txs, accs)
      result.period = `${from} a ${to}`
      setDre(result)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  const refRevenue = dre?.receitaLiquida || dre?.receitaBruta || 1

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">DRE</h2>
          <p className="text-slate-400 text-xs mt-0.5">Demonstração do Resultado do Exercício</p>
        </div>

        {/* Filtros de período */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${period === p ? 'bg-blue-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-xs">até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {dre && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Receita Bruta',       value: formatBRL(dre.receitaBruta),      color: 'text-blue-700' },
            { label: 'Lucro Bruto',         value: formatBRL(dre.lucroBruto),         sub: formatPercent(dre.margemBruta),    color: dre.margemBruta >= BENCHMARK.margemBruta.min ? 'text-emerald-600' : 'text-amber-500' },
            { label: 'Lucro Operacional',   value: formatBRL(dre.lucroOperacional),  color: dre.lucroOperacional >= 0 ? 'text-blue-700' : 'text-red-500' },
            { label: 'Lucro Líquido',       value: formatBRL(dre.lucroLiquido),       sub: formatPercent(dre.margemLiquida),  color: dre.margemLiquida >= BENCHMARK.margemLiquida.min ? 'text-emerald-600' : dre.margemLiquida >= BENCHMARK.margemLiquida.min * 0.8 ? 'text-amber-500' : 'text-red-500' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</p>
              <p className={`font-mono text-lg font-semibold leading-none ${color}`}>{value}</p>
              {sub && <p className={`text-xs mt-1.5 font-medium ${color}`}>{sub} da receita</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabela DRE */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Demonstração do Resultado</h3>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Acima do benchmark</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Atenção</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Abaixo</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Calculando DRE...</p>
          </div>
        ) : !dre || transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Nenhuma transação no período selecionado.</p>
            <p className="text-gray-300 text-xs mt-1">Adicione transações em Transações ou Importar.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-2.5">Conta</th>
                <th className="text-right px-4 py-2.5">Valor</th>
                <th className="text-right px-4 py-2.5">% Receita</th>
                <th className="text-right px-4 py-2.5">Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {dre.lines.map(line => (
                <DRERow
                  key={line.code}
                  line={line}
                  expanded={expanded.has(line.code)}
                  onToggle={() => toggle(line.code)}
                  refRevenue={refRevenue}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Receita por canal */}
      {dre && Object.keys(dre.receitaPorCanal).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Receita por Canal</h3>
          <div className="space-y-2">
            {Object.entries(dre.receitaPorCanal)
              .sort(([, a], [, b]) => b - a)
              .map(([channel, amount]) => {
                const pct = calcPercent(amount, dre.receitaBruta)
                return (
                  <div key={channel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 capitalize">{channel.replace('_', ' ')}</span>
                      <span className="text-gray-700 font-medium">{formatBRL(amount)} · {formatPercent(pct)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
