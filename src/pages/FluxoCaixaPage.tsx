import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions } from '../lib/api/transactions'
import { getRecurring } from '../lib/api/recurring'
import { getForecastEntries, getBankAccounts } from '../features/finance/services/financeApi'
import { generateCashFlowProjection } from '../lib/cashflow'
import { formatBRL } from '../lib/currency'
import { addDays } from 'date-fns'

type ProjectionPeriod = '30d' | '3m' | '6m'

export default function FluxoCaixaPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  interface CashFlowChartRow {
    date: string
    fullDate: string
    receitas: number
    despesas: number
    saldoAcumulado: number
    receitasPrevistas: number
    despesasPrevistas: number
  }

  const [period, setPeriod] = useState<ProjectionPeriod>('30d')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CashFlowChartRow[]>([])

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : activeCompanyId ? [activeCompanyId] : []

  const loadCashFlow = async () => {
    setLoading(true)
    try {
      const today = new Date()
      let endDays = 30
      if (period === '3m') endDays = 90
      if (period === '6m') endDays = 180

      const endDate = addDays(today, endDays)

      const startStr = today.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const singleCompanyId = activeCompanyId && activeCompanyId !== 'consolidated' ? activeCompanyId : null
      const [txs, recurring, forecastEntries, bankAccountsPerCompany] = await Promise.all([
        getTransactions({ companyIds, isSimulation }),
        getRecurring({ companyIds, isSimulation, status: 'active' }),
        singleCompanyId
          ? getForecastEntries(singleCompanyId, startStr, endStr).catch(() => [])
          : Promise.resolve([]),
        Promise.all(companyIds.map(id => getBankAccounts(id))),
      ])

      // Saldo inicial: soma dos saldos reais das contas bancárias (current_balance em reais → converte para centavos)
      const allBankAccounts = bankAccountsPerCompany.flat()
      const initialBalance = allBankAccounts.reduce((sum, ba) => sum + Math.round((ba.current_balance ?? 0) * 100), 0)

      // Gera projeção
      const projectedTxs = generateCashFlowProjection(txs, recurring, startStr, endStr)

      // Agrupar por dia
      const dailyMap = new Map<string, { receitas: number, despesas: number, saldo: number }>()

      // Preenche os dias vazios na janela para o gráfico ficar contínuo
      for (let i = 0; i <= endDays; i++) {
        const d = addDays(today, i).toISOString().split('T')[0]
        dailyMap.set(d, { receitas: 0, despesas: 0, saldo: 0 })
      }

      for (const pt of projectedTxs) {
        if (dailyMap.has(pt.date)) {
          const entry = dailyMap.get(pt.date)!
          if (pt.type === 'receita') entry.receitas += pt.amount_cents
          else entry.despesas += pt.amount_cents
        }
      }

      // Mapa de previsões por dia
      const forecastMap = new Map<string, { receitas: number; despesas: number }>()
      for (const fe of forecastEntries) {
        const d = fe.due_date
        if (!forecastMap.has(d)) forecastMap.set(d, { receitas: 0, despesas: 0 })
        const f = forecastMap.get(d)!
        if (fe.type === 'receivable') f.receitas += fe.amount * 100
        else f.despesas += fe.amount * 100
      }

      // Constrói array para o gráfico com saldo acumulado
      const chartData: CashFlowChartRow[] = []
      let currentBalance = initialBalance

      // Ordenar chaves
      const sortedDates = Array.from(dailyMap.keys()).sort()

      for (const d of sortedDates) {
        const entry = dailyMap.get(d)!
        currentBalance += (entry.receitas - entry.despesas)
        const forecast = forecastMap.get(d) ?? { receitas: 0, despesas: 0 }

        // Converte data para exibir melhor
        const [, mm, dd] = d.split('-')
        chartData.push({
          date: `${dd}/${mm}`,
          fullDate: d,
          receitas: entry.receitas / 100,
          despesas: -(entry.despesas / 100),
          saldoAcumulado: currentBalance / 100,
          receitasPrevistas: forecast.receitas / 100,
          despesasPrevistas: -(forecast.despesas / 100),
        })
      }

      setData(chartData)
    } catch (e) {
      console.error('Erro ao gerar fluxo de caixa', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (companyIds.length > 0) loadCashFlow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, isSimulation, period])

  // KPIs — inclui previsões na variação e no saldo final
  const saldoAtual = data.length > 0 ? data[0].saldoAcumulado : 0
  const saldoRealFinal = data.length > 0 ? data[data.length - 1].saldoAcumulado : 0
  const totalPrevistoEntradas = data.reduce((sum, d) => sum + d.receitasPrevistas, 0)
  const totalPrevistaSaidas  = data.reduce((sum, d) => sum + Math.abs(d.despesasPrevistas), 0)
  const variacaoPrevista = totalPrevistoEntradas - totalPrevistaSaidas
  const saldoFinal = saldoRealFinal + variacaoPrevista
  const variacao = saldoFinal - saldoAtual

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fluxo de Caixa e Projeção</h1>
          <p className="text-slate-500 text-sm mt-1">Previsão financeira baseada em lançamentos e recorrências ativas.</p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={period} 
            onChange={e => setPeriod(e.target.value as ProjectionPeriod)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="30d">Próximos 30 dias</option>
            <option value="3m">Próximos 3 meses</option>
            <option value="6m">Próximos 6 meses</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Saldo Atual (Hoje)</p>
          <p className="text-3xl font-bold text-slate-800">{formatBRL(saldoAtual * 100)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Variação Projetada</p>
          <p className={`text-3xl font-bold ${variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {variacao > 0 ? '+' : ''}{formatBRL(variacao * 100)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Saldo Final Projetado</p>
          <p className={`text-3xl font-bold ${saldoFinal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
            {formatBRL(saldoFinal * 100)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800">Gráfico de Projeção Diária</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400"></div>Entradas</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400"></div>Saídas</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-300 opacity-80"></div>Prev. Entrada</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-300 opacity-80"></div>Prev. Saída</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-600"></div>Saldo Acumulado</span>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 0, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis 
                  yAxisId="left" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748B' }} 
                  tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748B' }} 
                  tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} 
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const labels: Record<string, string> = {
                        receitas: 'Entradas',
                        despesas: 'Saídas',
                        receitasPrevistas: 'Prev. Entradas',
                        despesasPrevistas: 'Prev. Saídas',
                        saldoAcumulado: 'Saldo',
                      }
                      const negative = new Set(['despesas', 'despesasPrevistas'])
                      return (
                        <div className="bg-white border border-gray-100 p-3 shadow-lg rounded-xl">
                          <p className="font-bold text-slate-800 mb-2">{label}</p>
                          {payload.map((p, i) => {
                            const key = String(p.name)
                            if (Number(p.value) === 0) return null
                            return (
                              <div key={i} className="flex justify-between gap-4 text-sm mb-1">
                                <span style={{ color: p.color }} className="font-medium">{labels[key] ?? key}</span>
                                <span className="font-bold text-slate-700">{formatBRL(Number(p.value) * (negative.has(key) ? -100 : 100))}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <ReferenceLine y={0} yAxisId="left" stroke="#CBD5E1" />
                
                <Bar yAxisId="left" dataKey="receitas" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="left" dataKey="despesas" fill="#F87171" radius={[0, 0, 4, 4]} maxBarSize={32} />
                <Bar yAxisId="left" dataKey="receitasPrevistas" fill="#A78BFA" fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="left" dataKey="despesasPrevistas" fill="#FDBA74" fillOpacity={0.7} radius={[0, 0, 4, 4]} maxBarSize={32} />
                <Line yAxisId="right" type="monotone" dataKey="saldoAcumulado" stroke="#2563EB" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
