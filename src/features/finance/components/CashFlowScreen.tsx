import { useEffect, useMemo, useState } from 'react'
import FinancialKpiCard from './FinancialKpiCard'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import CashFlowProjectionChart from './CashFlowProjectionChart'
import { calculateCashFlowProjection, calculateAgingBuckets } from '../services/financeCalculations'
import {
  getChartAccounts,
  getFinancialEntries,
  getBankAccounts,
} from '../services/financeApi'
import {
  simulationChartAccounts,
  simulationFinancialEntries,
  simulationBankAccounts,
} from '../data/simulationData'
import { useSimulation } from '../../../contexts/SimulationContext'
import EmptyFinancialState from './EmptyFinancialState'
import { fmtBRL } from '../../../lib/currency'
import type {
  ChartAccount,
  FinancialEntry,
  BankAccount,
  DateRange,
} from '../types/finance.types'

interface Props {
  companyId: string
  startDate: string
  endDate: string
  onPeriodChange?: (range: DateRange) => void
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

const statusLabels: Record<string, string> = {
  healthy: 'Saudavel',
  warning: 'Atencao',
  critical: 'Critico',
}

const statusColors: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
}

export default function CashFlowScreen({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [, setChartAccounts] = useState<ChartAccount[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
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
          setBankAccounts(simulationBankAccounts)
          setLoading(false)
        }
        return
      }

      if (!companyId || companyId === 'consolidated') {
        if (!cancelled) {
          setEntries([])
          setChartAccounts([])
          setBankAccounts([])
          setLoading(false)
        }
        return
      }

      try {
        const [accountsData, entriesData, banksData] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
          getBankAccounts(companyId),
        ])
        if (cancelled) return
        setEntries(entriesData)
        setChartAccounts(accountsData)
        setBankAccounts(banksData)
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

  const initialBalance = useMemo(
    () => bankAccounts.reduce((s, b) => s + b.current_balance, 0),
    [bankAccounts]
  )

  const projection = useMemo(
    () =>
      calculateCashFlowProjection(entries, initialBalance, startDate, endDate),
    [entries, initialBalance, startDate, endDate]
  )

  const today = new Date().toISOString().split('T')[0]

  const openReceivables = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.type === 'receivable' &&
            (e.status === 'open' || e.status === 'overdue')
        )
        .reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const openPayables = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.type === 'payable' &&
            (e.status === 'open' || e.status === 'overdue')
        )
        .reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const agingBuckets = useMemo(
    () => calculateAgingBuckets(entries, today),
    [entries, today]
  )

  const hasOverdue = agingBuckets.some((b) => b.receivable > 0 || b.payable > 0)

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
        <h1 className="text-2xl font-bold text-gray-900">Fluxo de Caixa</h1>
        <p className="text-sm text-gray-500">
          Projecao diaria por regime de caixa
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
          title="Saldo Atual"
          value={fmtBRL(initialBalance)}
          subtitle={`${bankAccounts.length} conta(s)`}
        />
        <FinancialKpiCard
          title="Projecao 7 dias"
          value={fmtBRL(projection.projectedBalance7d)}
          subtitle="Saldo previsto"
          variant={projection.projectedBalance7d >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Projecao 15 dias"
          value={fmtBRL(projection.rows[14]?.closingBalance ?? projection.projectedBalance7d)}
          subtitle="Saldo previsto"
          variant={(projection.rows[14]?.closingBalance ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Projecao 30 dias"
          value={fmtBRL(projection.projectedBalance30d)}
          subtitle="Saldo previsto"
          variant={projection.projectedBalance30d >= 0 ? 'positive' : 'negative'}
        />
        <FinancialKpiCard
          title="Menor Saldo Projetado"
          value={fmtBRL(projection.lowestProjectedBalance)}
          subtitle="Pior cenario"
          variant={projection.lowestProjectedBalance < 0 ? 'negative' : projection.lowestProjectedBalance < initialBalance * 0.1 ? 'warning' : 'positive'}
        />
        <FinancialKpiCard
          title="Dias com Risco Negativo"
          value={String(projection.negativeCashDays)}
          subtitle="No periodo selecionado"
          variant={projection.negativeCashDays > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FinancialKpiCard
          title="A Receber em Aberto"
          value={fmtBRL(openReceivables)}
          subtitle="Total previsto"
          variant="positive"
        />
        <FinancialKpiCard
          title="A Pagar em Aberto"
          value={fmtBRL(openPayables)}
          subtitle="Total previsto"
          variant="negative"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Projecao Diaria</h3>
          <span className="text-xs text-gray-500">
            Regime: <span className="font-semibold text-gray-600">Caixa</span>
          </span>
        </div>
        <CashFlowProjectionChart projection={projection} />
      </div>

      {hasOverdue && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Inadimplência por Faixa de Atraso</h3>
          <p className="text-xs text-gray-500 mb-4">Contas vencidas e não liquidadas, agrupadas por tempo de atraso</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Faixa</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">A Receber</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qtd.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">A Pagar</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qtd.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agingBuckets.map((bucket) => {
                  const total = bucket.receivable + bucket.payable
                  if (total === 0) return null
                  return (
                    <tr key={bucket.label} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{bucket.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                        {bucket.receivable > 0 ? fmtBRL(bucket.receivable) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">
                        {bucket.receivableCount > 0 ? bucket.receivableCount : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-700">
                        {bucket.payable > 0 ? fmtBRL(bucket.payable) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">
                        {bucket.payableCount > 0 ? bucket.payableCount : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                        {fmtBRL(total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">
                    {fmtBRL(agingBuckets.reduce((s, b) => s + b.receivable, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold text-gray-700">
                    {agingBuckets.reduce((s, b) => s + b.receivableCount, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-700">
                    {fmtBRL(agingBuckets.reduce((s, b) => s + b.payable, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold text-gray-700">
                    {agingBuckets.reduce((s, b) => s + b.payableCount, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                    {fmtBRL(agingBuckets.reduce((s, b) => s + b.receivable + b.payable, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Detalhamento Diario</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo Inicial</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entradas Prev.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entradas Real.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saidas Prev.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saidas Real.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo Final</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projection.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum dado para o periodo.
                  </td>
                </tr>
              )}
              {projection.rows.map((row) => {
                const isToday = row.date === today
                return (
                  <tr key={row.date} className={`hover:bg-gray-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-2 text-gray-700 font-medium">
                      {fmtDate(row.date)}
                      {isToday && <span className="ml-1 text-xs text-blue-600">(hoje)</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtBRL(row.openingBalance)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">
                      {row.projectedInflow > 0 ? fmtBRL(row.projectedInflow) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">
                      {row.realizedInflow > 0 ? fmtBRL(row.realizedInflow) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">
                      {row.projectedOutflow > 0 ? fmtBRL(row.projectedOutflow) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-red-700">
                      {row.realizedOutflow > 0 ? fmtBRL(row.realizedOutflow) : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${row.closingBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {fmtBRL(row.closingBalance)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[row.status]}`}>
                        {statusLabels[row.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-700">Totais</td>
                <td />
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                  {fmtBRL(projection.rows.reduce((s, r) => s + r.projectedInflow, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                  {fmtBRL(projection.rows.reduce((s, r) => s + r.realizedInflow, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">
                  {fmtBRL(projection.rows.reduce((s, r) => s + r.projectedOutflow, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">
                  {fmtBRL(projection.rows.reduce((s, r) => s + r.realizedOutflow, 0))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
