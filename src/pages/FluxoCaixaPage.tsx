import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import { Calendar, Filter, Download } from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions } from '../lib/api/transactions'
import { getRecurring } from '../lib/api/recurring'
import { generateCashFlowProjection } from '../lib/cashflow'
import { formatBRL } from '../lib/currency'
import { addDays } from 'date-fns'

type ProjectionPeriod = '30d' | '3m' | '6m'

export default function FluxoCaixaPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  const [period, setPeriod] = useState<ProjectionPeriod>('30d')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : activeCompanyId ? [activeCompanyId] : []

  useEffect(() => {
    if (companyIds.length > 0) loadCashFlow()
  }, [activeCompanyId, isSimulation, period])

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

      const [txs, recurring] = await Promise.all([
        getTransactions({ companyIds, isSimulation }), // Busca histórico (para saldo inicial e manual)
        getRecurring({ companyIds, isSimulation, status: 'active' }) // Busca assinaturas/recorrências
      ])

      // Cálculo de Saldo Inicial (Todas as receitas reais - todas despesas reais até hoje)
      // Simplificado: Assumiremos que todas as transações passadas formam o saldo atual da empresa.
      let initialBalance = 0
      for (const tx of txs) {
        if (new Date(tx.date) < today) {
          initialBalance += tx.type === 'receita' ? tx.amount_cents : -tx.amount_cents
        }
      }

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

      // Constrói array para o gráfico com saldo acumulado
      const chartData = []
      let currentBalance = initialBalance

      // Ordenar chaves
      const sortedDates = Array.from(dailyMap.keys()).sort()

      for (const d of sortedDates) {
        const entry = dailyMap.get(d)!
        currentBalance += (entry.receitas - entry.despesas)
        
        // Converte data para exibir melhor
        const [yy, mm, dd] = d.split('-')
        chartData.push({
          date: `${dd}/${mm}`,
          fullDate: d,
          receitas: entry.receitas / 100,
          despesas: -(entry.despesas / 100), // Exibe como negativo no gráfico
          saldoAcumulado: currentBalance / 100
        })
      }

      setData(chartData)
    } catch (e) {
      console.error('Erro ao gerar fluxo de caixa', e)
    }
    setLoading(false)
  }

  // KPIs
  const saldoAtual = data.length > 0 ? data[0].saldoAcumulado : 0
  const saldoFinal = data.length > 0 ? data[data.length - 1].saldoAcumulado : 0
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
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400"></div>Entradas</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400"></div>Saídas</span>
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
                      return (
                        <div className="bg-white border border-gray-100 p-3 shadow-lg rounded-xl">
                          <p className="font-bold text-slate-800 mb-2">{label}</p>
                          {payload.map((p, i) => (
                            <div key={i} className="flex justify-between gap-4 text-sm mb-1">
                              <span style={{ color: p.color }} className="font-medium">{p.name === 'saldoAcumulado' ? 'Saldo' : p.name === 'receitas' ? 'Entradas' : 'Saídas'}</span>
                              <span className="font-bold text-slate-700">{formatBRL(Number(p.value) * (p.name === 'despesas' ? -100 : 100))}</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <ReferenceLine y={0} yAxisId="left" stroke="#CBD5E1" />
                
                <Bar yAxisId="left" dataKey="receitas" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="left" dataKey="despesas" fill="#F87171" radius={[0, 0, 4, 4]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="saldoAcumulado" stroke="#2563EB" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
