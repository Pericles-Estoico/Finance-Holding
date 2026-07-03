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
import FinancialKpiCard from './FinancialKpiCard'
import FinancialPeriodFilter from './FinancialPeriodFilter'
import CashFlowProjectionChart from './CashFlowProjectionChart'
import {
  calculateDRE,
  calculateEBITDA,
  calculateCashFlowProjection,
  getMonthlyRevenueTrend,
} from '../services/financeCalculations'
import {
  getChartAccounts,
  getFinancialEntries,
  getBankAccounts,
} from '../services/financeApi'
import { getCorporateChart } from '../services/corporateChartApi'
import { calculateIFRSDRE } from '../services/ifrsEngine'
import type { ChartAccountV2 } from '../services/corporateChartApi'
import {
  simulationChartAccounts,
  simulationFinancialEntries,
  simulationBankAccounts,
} from '../data/simulationData'
import { useSimulation } from '../../../contexts/SimulationContext'
import { fmtBRL } from '../../../lib/currency'
import AccountingEquationAlert from './AccountingEquationAlert'
import EmptyFinancialState from './EmptyFinancialState'
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

function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

export default function FinanceDashboard({
  companyId,
  startDate,
  endDate,
  onPeriodChange,
}: Props) {
  const { isSimulation } = useSimulation()

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [chartAccountsV2, setChartAccountsV2] = useState<ChartAccountV2[]>([])
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
        const [accountsData, entriesData, banksData, accountsV2Data] = await Promise.all([
          getChartAccounts(companyId),
          getFinancialEntries(companyId),
          getBankAccounts(companyId),
          getCorporateChart(companyId).catch(() => [] as ChartAccountV2[]),
        ])
        if (cancelled) return
        setEntries(entriesData)
        setChartAccounts(accountsData)
        setChartAccountsV2(accountsV2Data)
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

  const useIFRS = chartAccountsV2.length > 0

  const ifrsResult = useMemo(
    () => useIFRS ? calculateIFRSDRE(entries, chartAccountsV2, period) : null,
    [entries, chartAccountsV2, period, useIFRS]
  )

  const dre = useMemo(
    () => useIFRS ? calculateDRE([], chartAccounts, period) : calculateDRE(entries, chartAccounts, period),
    [entries, chartAccounts, period, useIFRS]
  )

  const filteredForEbitda = useMemo(
    () => entries.filter((e) => e.competence_date >= startDate && e.competence_date <= endDate),
    [entries, startDate, endDate]
  )

  const ebitda = useMemo(() => {
    if (ifrsResult) {
      const n = (d: { toNumber(): number }) => d.toNumber()
      return {
        netRevenue: n(ifrsResult.receitaLiquida),
        cogs: n(ifrsResult.cpv),
        grossProfit: n(ifrsResult.lucroBruto),
        eligibleExpenses: n(ifrsResult.totalDespesasOperacionais),
        ebitda: n(ifrsResult.ebitda),
        ebitdaMargin: n(ifrsResult.margemEBITDA),
        excludedItems: [],
        byGroup: {},
      }
    }
    return calculateEBITDA(dre, filteredForEbitda, chartAccounts)
  }, [ifrsResult, dre, filteredForEbitda, chartAccounts])

  const dreForDisplay = useMemo(() => {
    if (ifrsResult) {
      const n = (d: { toNumber(): number }) => d.toNumber()
      return {
        ...dre,
        receitaBruta: n(ifrsResult.receitaBruta),
        deducoes: n(ifrsResult.deducoes),
        receitaLiquida: n(ifrsResult.receitaLiquida),
        cmv: n(ifrsResult.cpv),
        lucroBruto: n(ifrsResult.lucroBruto),
        lucroLiquido: n(ifrsResult.lucroLiquido),
        margemBruta: n(ifrsResult.margemBruta),
        margemLiquida: n(ifrsResult.margemLiquida),
      }
    }
    return dre
  }, [ifrsResult, dre])

  const initialBalance = useMemo(
    () => bankAccounts.reduce((s, b) => s + b.current_balance, 0),
    [bankAccounts]
  )

  const projectionEnd = useMemo(() => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }, [startDate])

  const cashFlow = useMemo(
    () =>
      calculateCashFlowProjection(
        entries,
        initialBalance,
        startDate,
        projectionEnd
      ),
    [entries, initialBalance, startDate, projectionEnd]
  )

  const monthlyTrend = useMemo(
    () => getMonthlyRevenueTrend(entries, chartAccounts, 6),
    [entries, chartAccounts]
  )

  const today = new Date().toISOString().split('T')[0]

  const openReceivables = useMemo(
    () =>
      entries
        .filter((e) => e.type === 'receivable' && e.status === 'open')
        .reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const openPayables = useMemo(
    () =>
      entries
        .filter((e) => e.type === 'payable' && e.status === 'open')
        .reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const overdueReceivables = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.type === 'receivable' &&
            (e.status === 'overdue' ||
              (e.status === 'open' && e.due_date < today))
        )
        .reduce((s, e) => s + e.amount, 0),
    [entries, today]
  )

  const overduePayables = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.type === 'payable' &&
            (e.status === 'overdue' ||
              (e.status === 'open' && e.due_date < today))
        )
        .reduce((s, e) => s + e.amount, 0),
    [entries, today]
  )

  const balance7d = cashFlow.projectedBalance7d
  const balance15d = cashFlow.projectedBalance15d
  const balance30d = cashFlow.projectedBalance30d

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Geral</h1>
        <p className="text-sm text-gray-500">
          Visao executiva consolidada do periodo
        </p>
      </div>
      {onPeriodChange && (
        <FinancialPeriodFilter value={period} onChange={onPeriodChange} />
      )}
    </div>
  )

  if (!isSimulation) {
    if (error) {
      return (
        <div className="space-y-6">
          {headerBlock}
          <EmptyFinancialState variant="error" errorDetail={error} />
        </div>
      )
    }
    if (!companyId) {
      return (
        <div className="space-y-6">
          {headerBlock}
          <EmptyFinancialState variant="no-company" />
        </div>
      )
    }
    if (companyId === 'consolidated') {
      return (
        <div className="space-y-6">
          {headerBlock}
          <EmptyFinancialState variant="consolidated-blocked" />
        </div>
      )
    }
    if (entries.length === 0) {
      return (
        <div className="space-y-6">
          {headerBlock}
          <EmptyFinancialState variant="no-data" />
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      {headerBlock}

      {!isSimulation && companyId !== 'consolidated' && (
        <AccountingEquationAlert companyId={companyId} entries={entries} />
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Resultado do Periodo
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            title="Receita Bruta"
            value={fmtBRL(dreForDisplay.receitaBruta)}
            subtitle="Periodo selecionado"
          />
          <FinancialKpiCard
            title="Receita Liquida"
            value={fmtBRL(dreForDisplay.receitaLiquida)}
            subtitle={`Deducoes: ${fmtBRL(dreForDisplay.deducoes)}`}
            variant="positive"
          />
          <FinancialKpiCard
            title="Lucro Bruto"
            value={fmtBRL(dreForDisplay.lucroBruto)}
            subtitle={`Margem: ${fmtPct(dreForDisplay.margemBruta)}`}
            variant={dreForDisplay.lucroBruto >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Margem Bruta"
            value={fmtPct(dreForDisplay.margemBruta)}
            subtitle="Lucro bruto / Rec. liquida"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Performance Operacional
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            title="EBITDA"
            value={fmtBRL(ebitda.ebitda)}
            subtitle="Lucro Op. antes de J/D/A/I"
            variant={ebitda.ebitda >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Margem EBITDA"
            value={fmtPct(ebitda.ebitdaMargin)}
            subtitle="EBITDA / Rec. liquida"
            variant={ebitda.ebitdaMargin >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Lucro Liquido"
            value={fmtBRL(dreForDisplay.lucroLiquido)}
            subtitle="Resultado final do periodo"
            variant={dreForDisplay.lucroLiquido >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Margem Liquida"
            value={fmtPct(dreForDisplay.margemLiquida)}
            subtitle="Lucro liquido / Rec. liquida"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Posicao de Caixa
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            title="Saldo de Caixa Atual"
            value={fmtBRL(initialBalance)}
            subtitle={`${bankAccounts.length} conta(s)`}
            variant="default"
          />
          <FinancialKpiCard
            title="Projecao 7 dias"
            value={fmtBRL(balance7d)}
            subtitle="Saldo projetado"
            variant={balance7d >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Projecao 15 dias"
            value={fmtBRL(balance15d)}
            subtitle="Saldo projetado"
            variant={balance15d >= 0 ? 'positive' : 'negative'}
          />
          <FinancialKpiCard
            title="Projecao 30 dias"
            value={fmtBRL(balance30d)}
            subtitle="Saldo projetado"
            variant={balance30d >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Recebimentos & Pagamentos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            title="A Receber Aberto"
            value={fmtBRL(openReceivables)}
            subtitle="Total em aberto"
            variant="default"
          />
          <FinancialKpiCard
            title="A Pagar Aberto"
            value={fmtBRL(openPayables)}
            subtitle="Total em aberto"
            variant="default"
          />
          <FinancialKpiCard
            title="Vencidos a Receber"
            value={fmtBRL(overdueReceivables)}
            subtitle="Atrasos clientes"
            variant={overdueReceivables > 0 ? 'warning' : 'default'}
          />
          <FinancialKpiCard
            title="Vencidos a Pagar"
            value={fmtBRL(overduePayables)}
            subtitle="Atrasos fornecedores"
            variant={overduePayables > 0 ? 'negative' : 'default'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Fluxo de Caixa Projetado (30 dias)
            </h3>
            <span className="text-xs text-gray-500">
              Saldo final: <span className={balance30d >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{fmtBRL(balance30d)}</span>
            </span>
          </div>
          <CashFlowProjectionChart projection={cashFlow} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Receita x Despesa (6 meses)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      receita: 'Receita Liquida',
                      despesa: 'Despesa Total',
                    }
                    return [fmtBRL(Number(value) || 0), labels[String(name)] ?? String(name)]
                  }}
                />
                <Legend
                  formatter={(v) => {
                    const labels: Record<string, string> = {
                      receita: 'Receita Liquida',
                      despesa: 'Despesa Total',
                    }
                    return labels[v] ?? v
                  }}
                />
                <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">EBITDA Mensal (6 meses)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip formatter={(value) => [fmtBRL(Number(value) || 0), 'EBITDA']} />
              <Bar dataKey="ebitda" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
