import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import { getFinancialEntries } from '../services/financeApi'
import { getCorporateChart } from '../services/corporateChartApi'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import { mockFinancialEntries } from '../data/mockFinancialData'
import { useSimulation } from '../../../contexts/SimulationContext'
import { calculateBalanceSheet, calculateLiquidity } from '../services/balanceSheetCalculations'
import type { BPLine } from '../services/balanceSheetCalculations'
import { fmtBRL } from '../../../lib/currency'
import type { FinancialEntry, DateRange } from '../types/finance.types'

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(1) + '%'
}

function fmtIdx(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(2)
}

function BPLineRow({ line, depth = 0 }: { line: BPLine; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = line.children.length > 0
  const paddingLeft = depth * 20 + 12

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${depth === 0 ? 'bg-gray-50' : ''}`}
        onClick={() => hasChildren && setOpen((v) => !v)}
      >
        <td className="py-2 pr-4 text-gray-500 text-xs font-mono" style={{ paddingLeft: 12 }}>
          {line.account.account_code}
        </td>
        <td className="py-2 text-sm" style={{ paddingLeft }}>
          <span className={depth === 0 ? 'font-bold text-gray-900' : depth === 1 ? 'font-semibold text-gray-800' : 'text-gray-600'}>
            {line.account.account_name}
          </span>
          {hasChildren && (
            <span className="ml-1 text-xs text-gray-400">{open ? '▾' : '▸'}</span>
          )}
        </td>
        <td className={`py-2 text-right font-mono text-sm px-4 ${depth === 0 ? 'font-bold text-gray-900' : line.balance >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
          {fmtBRL(line.balance)}
        </td>
      </tr>
      {open && line.children.map((child) => (
        <BPLineRow key={child.account.id} line={child} depth={depth + 1} />
      ))}
    </>
  )
}

interface LiquidityCardProps {
  label: string
  value: string
  formula: string
  status: 'green' | 'yellow' | 'red' | 'neutral'
}

function LiquidityCard({ label, value, formula, status }: LiquidityCardProps) {
  const colors = {
    green: 'border-emerald-200 bg-emerald-50',
    yellow: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
    neutral: 'border-gray-200 bg-gray-50',
  }
  const dotColors = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
    neutral: 'bg-gray-400',
  }

  return (
    <div className={`rounded-xl border p-4 ${colors[status]}`}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className={`w-2 h-2 rounded-full mt-1 ${dotColors[status]}`} />
      </div>
      <div className="text-xl font-bold text-gray-900 font-mono">{value}</div>
      <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
        <Info className="w-3 h-3" />
        {formula}
      </div>
    </div>
  )
}

export default function BalanceSheetScreen({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [accounts, setAccounts] = useState<ChartAccountV2[]>([])
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (isSimulation || !companyId || companyId === 'consolidated') {
        if (!cancelled) {
          setEntries(mockFinancialEntries)
          setLoading(false)
          setNoData(false)
        }
        return
      }
      try {
        const [entriesData, accountsData] = await Promise.all([
          getFinancialEntries(companyId),
          getCorporateChart(companyId),
        ])
        if (cancelled) return
        if (accountsData.length === 0) {
          setNoData(true)
          setEntries(mockFinancialEntries)
        } else {
          setEntries(entriesData)
          setAccounts(accountsData)
          setNoData(false)
        }
      } catch {
        if (!cancelled) {
          setEntries(mockFinancialEntries)
          setNoData(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [companyId, isSimulation])

  const period = useMemo<DateRange>(() => ({ from: startDate, to: endDate }), [startDate, endDate])

  const bs = useMemo(() => {
    if (accounts.length === 0) return null
    return calculateBalanceSheet(accounts, entries)
  }, [accounts, entries])

  const liquidity = useMemo(() => {
    if (!bs) return null
    return calculateLiquidity(bs)
  }, [bs])

  const lcStatus = (lc: number | null): 'green' | 'yellow' | 'red' | 'neutral' => {
    if (lc === null) return 'neutral'
    if (lc >= 1.5) return 'green'
    if (lc >= 1.0) return 'yellow'
    return 'red'
  }

  const endivStatus = (e: number | null): 'green' | 'yellow' | 'red' | 'neutral' => {
    if (e === null) return 'neutral'
    if (e <= 40) return 'green'
    if (e <= 60) return 'yellow'
    return 'red'
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
          <h1 className="text-2xl font-bold text-gray-900">Balanço Patrimonial</h1>
          <p className="text-sm text-gray-500">IFRS — Ativo = Passivo + Patrimônio Líquido</p>
        </div>
        {onPeriodChange && (
          <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
        )}
      </div>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Plano de Contas Corporativo não encontrado. Configure o plano em Configurações → Plano Corporativo para ver o Balanço Patrimonial.
        </div>
      )}

      {bs && (
        <>
          {/* Badge de equilíbrio */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bs.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {bs.isBalanced ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div>
              <span className={`font-semibold text-sm ${bs.isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
                {bs.isBalanced ? 'Equação Contábil Equilibrada — A = P + PL' : `Desequilíbrio contábil — Delta: ${fmtBRL(bs.delta)}`}
              </span>
              <div className="text-xs text-gray-500 mt-0.5">
                Ativo Total: {fmtBRL(bs.ativo.total)} · Passivo + PL: {fmtBRL(bs.totalPassivoEPL)}
              </div>
            </div>
          </div>

          {/* BP em 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ativo */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-blue-600 px-4 py-3">
                <h3 className="font-bold text-white text-sm">ATIVO</h3>
                <div className="text-blue-100 text-xs font-mono">{fmtBRL(bs.ativo.total)}</div>
              </div>

              {bs.ativo.circulante.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-xs font-bold text-blue-700 uppercase">Circulante</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {bs.ativo.circulante.map((line) => (
                        <BPLineRow key={line.account.id} line={line} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {bs.ativo.naoCirculante.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 border-t border-blue-100">
                    <span className="text-xs font-bold text-blue-700 uppercase">Não Circulante</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {bs.ativo.naoCirculante.map((line) => (
                        <BPLineRow key={line.account.id} line={line} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {bs.ativo.circulante.length === 0 && bs.ativo.naoCirculante.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Sem contas de Ativo com saldo
                </div>
              )}
            </div>

            {/* Passivo + PL */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-slate-700 px-4 py-3">
                <h3 className="font-bold text-white text-sm">PASSIVO + PATRIMÔNIO LÍQUIDO</h3>
                <div className="text-slate-300 text-xs font-mono">{fmtBRL(bs.totalPassivoEPL)}</div>
              </div>

              {bs.passivo.circulante.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-600 uppercase">Passivo Circulante</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {bs.passivo.circulante.map((line) => (
                        <BPLineRow key={line.account.id} line={line} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {bs.passivo.naoCirculante.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-600 uppercase">Passivo Não Circulante</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {bs.passivo.naoCirculante.map((line) => (
                        <BPLineRow key={line.account.id} line={line} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {bs.patrimonioLiquido.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 border-t border-slate-100">
                    <span className="text-xs font-bold text-emerald-700 uppercase">Patrimônio Líquido</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {bs.patrimonioLiquido.map((line) => (
                        <BPLineRow key={line.account.id} line={line} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {bs.passivo.circulante.length === 0 && bs.passivo.naoCirculante.length === 0 && bs.patrimonioLiquido.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Sem contas de Passivo / PL com saldo
                </div>
              )}
            </div>
          </div>

          {/* Indicadores de Liquidez (Story 4.2) */}
          {liquidity && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Indicadores de Liquidez e Solvência</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <LiquidityCard
                  label="Liquidez Corrente"
                  value={fmtIdx(liquidity.liquidezCorrente)}
                  formula="AC / PC"
                  status={lcStatus(liquidity.liquidezCorrente)}
                />
                <LiquidityCard
                  label="Liquidez Seca"
                  value={fmtIdx(liquidity.liquidezSeca)}
                  formula="(AC - Est.) / PC"
                  status={lcStatus(liquidity.liquidezSeca)}
                />
                <LiquidityCard
                  label="Liquidez Geral"
                  value={fmtIdx(liquidity.liquidezGeral)}
                  formula="(AC + ANC) / (PC + PNC)"
                  status={lcStatus(liquidity.liquidezGeral)}
                />
                <LiquidityCard
                  label="Endividamento"
                  value={fmtPct(liquidity.endividamento)}
                  formula="Passivo / (P + PL)"
                  status={endivStatus(liquidity.endividamento)}
                />
                <LiquidityCard
                  label="Capital de Giro"
                  value={fmtBRL(liquidity.capitalDeGiro)}
                  formula="AC - PC"
                  status={liquidity.capitalDeGiro >= 0 ? 'green' : 'red'}
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Verde: LC ≥ 1.5 · Amarelo: 1.0–1.5 · Vermelho: &lt; 1.0. Endividamento: verde ≤ 40%, vermelho &gt; 60%.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
