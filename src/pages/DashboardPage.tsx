import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  DollarSign, ShoppingBag, Percent, Activity, AlertTriangle,
  Zap, Target, BarChart3, Radio, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions } from '../lib/api/transactions'
import { getAccounts } from '../lib/api/accounts'
import { calcDRE, formatBRL, formatPercent } from '../lib/dre'
import type { Transaction, AccountCategory } from '../types'
import { getCorporateChart } from '../features/finance/services/corporateChartApi'
import type { ChartAccountV2 } from '../features/finance/services/corporateChartApi'
import Decimal from 'decimal.js'
import PeriodChips from '../components/ui/PeriodChips'

// ─── Constantes ───────────────────────────────────────────────────────────────

type Period = 'hoje' | 'mes_atual' | 'trimestre' | 'ano_atual' | 'custom'
const PERIOD_LABELS: Record<Period, string> = {
  hoje: 'Hoje', mes_atual: 'Este mês', trimestre: 'Trimestre', ano_atual: 'Este ano', custom: 'Personalizado',
}

const BM = { margemBruta: { min: 55, max: 70 }, margemLiquida: { min: 18, max: 26 }, aov: { min: 20000, max: 50000 } }

const CH_COLOR: Record<string, string> = {
  amazon: '#F59E0B', shopify: '#10B981', varejo_fisico: '#3B82F6',
  b2b: '#A78BFA', mercado_livre: '#FBBF24', outros: '#6B7280',
}
const CH_NAME: Record<string, string> = {
  amazon: 'Amazon', shopify: 'Shopify', varejo_fisico: 'Varejo Físico',
  b2b: 'B2B', mercado_livre: 'Merc. Livre', outros: 'Outros',
}

// ─── Período ─────────────────────────────────────────────────────────────────

function getRange(p: Period, f: string, t: string) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate()
  const hojeStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  if (p === 'hoje') return { from: hojeStr, to: hojeStr }
  if (p === 'mes_atual') return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` }
  if (p === 'trimestre') { const q=Math.floor(m/3); return { from:`${y}-${String(q*3+1).padStart(2,'0')}-01`, to:`${y}-${String(Math.min(q*3+3,12)).padStart(2,'0')}-30` } }
  if (p === 'ano_atual') return { from: `${y}-01-01`, to: `${y}-12-31` }
  return { from: f, to: t }
}
function getPrevRange(p: Period, f: string, t: string) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth()
  if (p === 'hoje') {
    const yest = new Date(y, m, n.getDate() - 1)
    const ontemStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`
    return { from: ontemStr, to: ontemStr }
  }
  if (p === 'mes_atual') { const pm=m===0?12:m,py=m===0?y-1:y; return { from:`${py}-${String(pm).padStart(2,'0')}-01`, to:`${py}-${String(pm).padStart(2,'0')}-31` } }
  if (p === 'trimestre') { const q=Math.floor(m/3),pq=q===0?3:q-1,py=q===0?y-1:y; return { from:`${py}-${String(pq*3+1).padStart(2,'0')}-01`, to:`${py}-${String(Math.min(pq*3+3,12)).padStart(2,'0')}-30` } }
  if (p === 'ano_atual') return { from: `${y-1}-01-01`, to: `${y-1}-12-31` }
  if (f&&t) { const fd=new Date(f),td=new Date(t),d=td.getTime()-fd.getTime(); return { from:new Date(fd.getTime()-d-86400000).toISOString().slice(0,10), to:new Date(fd.getTime()-86400000).toISOString().slice(0,10) } }
  return { from:'', to:'' }
}
function get12m() { const n=new Date(); return { from:new Date(n.getFullYear()-1,n.getMonth()+1,1).toISOString().slice(0,10), to:n.toISOString().slice(0,10) } }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delta(cur: number, prev: number) { if (!prev) return null; return ((cur-prev)/Math.abs(prev))*100 }
function fmtK(cents: number) { const v=cents/100; if(v>=1e6) return `${(v/1e6).toFixed(1)}M`; if(v>=1e3) return `${(v/1e3).toFixed(1)}K`; return v.toFixed(0) }
function statusColor(v: number, min: number) { return v>=min?'#10B981':v>=min*.8?'#F59E0B':'#EF4444' }
function bmStatus(v: number, min: number): 'ok'|'warn'|'bad' { return v>=min?'ok':v>=min*.8?'warn':'bad' }

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Instrument({ label, value, sub, delta: d, color='#3B82F6', icon, bm, bmVal }: {
  label: string; value: string; sub?: string; delta?: number|null; color?: string
  icon: ReactNode; bm?: {min:number;max:number}; bmVal?: number
}) {
  const dPos = d != null && d >= 0
  const s = bm && bmVal != null ? bmStatus(bmVal, bm.min) : null
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: color, opacity: 0.6 }} />
      <div className="flex items-start justify-between">
        <div className="p-1.5 rounded-lg" style={{ background: color + '20' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {d != null && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${dPos?'text-emerald-400':'text-red-400'}`}>
            {dPos ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
            {Math.abs(d).toFixed(1)}%
          </span>
        )}
        {d == null && s && (
          <span className={`text-xs font-bold ${s==='ok'?'text-emerald-400':s==='warn'?'text-amber-400':'text-red-400'}`}>
            {s==='ok'?'▲ OK':s==='warn'?'▲ ATENÇÃO':'▼ ABAIXO'}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="font-mono font-bold text-2xl leading-none text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {bm && bmVal != null && (
        <div className="mt-auto pt-2 border-t border-slate-800">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Benchmark {bm.min}–{bm.max}%</span>
            <span style={{ color: statusColor(bmVal, bm.min) }}>{formatPercent(bmVal)}</span>
          </div>
          <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${Math.min((bmVal/bm.max)*100,100)}%`, background: statusColor(bmVal, bm.min) }} />
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-blue-500" />
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{children}</span>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  const [period, setPeriod]         = useState<Period>('hoje')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null)

  const [curTxs,   setCurTxs]   = useState<Transaction[]>([])
  const [prevTxs,  setPrevTxs]  = useState<Transaction[]>([])
  const [trendTxs, setTrendTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts]     = useState<AccountCategory[]>([])
  const [chartAccountsV2, setChartAccountsV2] = useState<ChartAccountV2[]>([])

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : activeCompanyId ? [activeCompanyId] : []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [activeCompanyId, period, customFrom, customTo, isSimulation])

  async function loadData() {
    if (!companyIds.length) return
    setLoading(true)
    try {
      const cur  = getRange(period, customFrom, customTo)
      const prev = getPrevRange(period, customFrom, customTo)
      const t12  = get12m()
      const [accs, v2Accs] = await Promise.all([
        Promise.all(companyIds.map(id => getAccounts(id))).then(r => r.flat()),
        Promise.all(companyIds.map(id => getCorporateChart(id))).then(r => r.flat()).catch(() => [] as ChartAccountV2[]),
      ])
      setAccounts(accs)
      setChartAccountsV2(v2Accs)
      const [c, p, t] = await Promise.all([
        getTransactions({ companyIds, isSimulation, dateFrom: cur.from, dateTo: cur.to }),
        prev.from ? getTransactions({ companyIds, isSimulation, dateFrom: prev.from, dateTo: prev.to }) : Promise.resolve([] as Transaction[]),
        getTransactions({ companyIds, isSimulation, dateFrom: t12.from, dateTo: t12.to }),
      ])
      setCurTxs(c); setPrevTxs(p); setTrendTxs(t)
      setLastUpdate(new Date())
    } finally { setLoading(false) }
  }

  const accMap   = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const v2AccMap = useMemo(() => new Map(chartAccountsV2.map(a => [a.id, a])), [chartAccountsV2])
  const curDRE  = useMemo(() => (accounts.length || chartAccountsV2.length) ? calcDRE(curTxs,  accounts, chartAccountsV2) : null, [curTxs,  accounts, chartAccountsV2])
  const prevDRE = useMemo(() => ((accounts.length || chartAccountsV2.length) && prevTxs.length) ? calcDRE(prevTxs, accounts, chartAccountsV2) : null, [prevTxs, accounts, chartAccountsV2])

  const curAOV = useMemo(() => {
    const n = curTxs.filter(tx => {
      const acc = accMap.get(tx.account_id ?? '')
      if (acc) return acc.type === 'receita' && !acc.code.startsWith('1.0')
      return v2AccMap.get(tx.chart_account_v2_id ?? '')?.account_class === 'REVENUE'
    }).length
    return n > 0 && curDRE ? Math.round(curDRE.receitaBruta / n) : 0
  }, [curTxs, accMap, v2AccMap, curDRE])

  const prevAOV = useMemo(() => {
    const n = prevTxs.filter(tx => {
      const acc = accMap.get(tx.account_id ?? '')
      if (acc) return acc.type === 'receita' && !acc.code.startsWith('1.0')
      return v2AccMap.get(tx.chart_account_v2_id ?? '')?.account_class === 'REVENUE'
    }).length
    return n > 0 && prevDRE ? Math.round(prevDRE.receitaBruta / n) : 0
  }, [prevTxs, accMap, v2AccMap, prevDRE])

  // Tendência 12m
  const trendData = useMemo(() => {
    const mo: Record<string, { receita: number; despesas: number }> = {}
    for (const tx of trendTxs) {
      const k = tx.date.slice(0,7)
      if (!mo[k]) mo[k] = { receita: 0, despesas: 0 }
      const acc = accMap.get(tx.account_id ?? '')
      if (acc) {
        if (acc.type === 'receita' && !acc.code.startsWith('1.0'))
          mo[k].receita = new Decimal(mo[k].receita).plus(tx.amount_cents).toNumber()
        else if (['cmv','despesa_operacional','imposto'].includes(acc.type))
          mo[k].despesas = new Decimal(mo[k].despesas).plus(tx.amount_cents).toNumber()
        continue
      }
      const v2acc = v2AccMap.get(tx.chart_account_v2_id ?? '')
      if (!v2acc) continue
      if (v2acc.account_class === 'REVENUE')
        mo[k].receita = new Decimal(mo[k].receita).plus(tx.amount_cents).toNumber()
      else if (v2acc.account_class === 'EXPENSE')
        mo[k].despesas = new Decimal(mo[k].despesas).plus(tx.amount_cents).toNumber()
    }
    return Object.entries(mo).sort(([a],[b])=>a.localeCompare(b)).map(([k,v]) => ({
      mes: new Date(k+'-01').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
      Receita:  parseFloat((v.receita/100).toFixed(2)),
      Despesas: parseFloat((v.despesas/100).toFixed(2)),
      Lucro:    parseFloat(((v.receita-v.despesas)/100).toFixed(2)),
    }))
  }, [trendTxs, accMap, v2AccMap])

  // Canais
  const chData = useMemo(() => {
    if (!curDRE) return []
    return Object.entries(curDRE.receitaPorCanal)
      .map(([ch,amt]) => ({ name: CH_NAME[ch]??ch, value: parseFloat((amt/100).toFixed(2)), fill: CH_COLOR[ch]??'#6B7280', raw: amt }))
      .filter(d=>d.value>0).sort((a,b)=>b.value-a.value)
  }, [curDRE])

  // Custos
  const costData = useMemo(() => {
    if (!curDRE) return []
    return [
      { name:'CMV',          value: curDRE.cmv,                  fill:'#EF4444' },
      { name:'Desp. Op.',    value: curDRE.despesasOperacionais,  fill:'#F59E0B' },
      { name:'Impostos',     value: curDRE.impostos,              fill:'#A78BFA' },
    ].filter(d=>d.value>0)
  }, [curDRE])
  const totalCosts = costData.reduce((s,d)=>s+d.value,0)

  const [bmOpen, setBmOpen] = useState(false)

  // Empresa ativa
  const activeCompany = companies.find(c => c.id === activeCompanyId)
  const noCompany = !companyIds.length

  const r  = curDRE?.receitaBruta  ?? 0
  const lb = curDRE?.lucroBruto    ?? 0
  const ll = curDRE?.lucroLiquido  ?? 0
  const lo = curDRE?.lucroOperacional ?? 0
  const mb = curDRE?.margemBruta   ?? 0
  const ml = curDRE?.margemLiquida ?? 0

  return (
    <div className="min-h-full bg-slate-950 -m-4 lg:-m-6 p-4 lg:p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 lg:mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden lg:inline">
            {loading ? 'ATUALIZANDO' : 'OPERACIONAL'}
          </span>
          <span className="text-xs text-slate-400 font-semibold lg:text-slate-500">
            {activeCompanyId === 'consolidated' ? 'Consolidado' : (activeCompany?.name ?? 'Sem empresa')}
          </span>
          {lastUpdate && (
            <span className="text-xs text-slate-600 hidden lg:inline">
              · Atualizado {lastUpdate.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop: botões inline */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${period===p?'bg-blue-800 text-white':'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                className="bg-transparent text-xs text-slate-300 outline-none" />
              <span className="text-slate-600 text-xs">→</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
                className="bg-transparent text-xs text-slate-300 outline-none" />
            </div>
          )}
          <button onClick={loadData}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} />
          </button>
        </div>
      </div>

      {/* Period chips — mobile only */}
      <div className="lg:hidden mb-4">
        <PeriodChips value={period} onChange={setPeriod} />
        {period === 'custom' && (
          <div className="flex items-center gap-2 mt-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none flex-1" />
            <span className="text-slate-600 text-xs">→</span>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none flex-1" />
          </div>
        )}
      </div>

      {noCompany ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <p className="text-slate-400 text-sm">Nenhuma empresa configurada.</p>
          <p className="text-slate-600 text-xs">Vá em Configurações e crie uma empresa.</p>
        </div>
      ) : (
        <>
          {/* ── PAINEL 1 — KPIs ── */}
          <div className="mb-4"><SectionLabel>Indicadores Principais</SectionLabel></div>

          {/* Mobile: hero + grid 2×2 */}
          <div className="lg:hidden mb-4 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Receita Bruta</span>
                {curDRE&&prevDRE&&(
                  <span className={`flex items-center gap-0.5 text-xs font-bold ${delta(r,prevDRE.receitaBruta)!>=0?'text-emerald-400':'text-red-400'}`}>
                    {delta(r,prevDRE.receitaBruta)!>=0?<ArrowUpRight className="w-3 h-3"/>:<ArrowDownRight className="w-3 h-3"/>}
                    {Math.abs(delta(r,prevDRE.receitaBruta)!).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="font-mono font-bold text-3xl text-white">R$ {fmtK(r)}</p>
              <p className="text-xs text-slate-600 mt-1">{curTxs.length} lançamentos no período</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Instrument label="Lucro Bruto" value={`R$ ${fmtK(lb)}`}
                delta={curDRE&&prevDRE?delta(lb,prevDRE.lucroBruto):null}
                color={lb>=0?'#10B981':'#EF4444'} icon={<TrendingUp className="w-4 h-4"/>} />
              <Instrument label="Lucro Líquido" value={`R$ ${fmtK(ll)}`}
                delta={curDRE&&prevDRE?delta(ll,prevDRE.lucroLiquido):null}
                color={ll>=0?'#10B981':'#EF4444'} icon={<Zap className="w-4 h-4"/>} />
              <Instrument label="Margem Bruta" value={formatPercent(mb)}
                bm={BM.margemBruta} bmVal={mb}
                color="#A78BFA" icon={<Percent className="w-4 h-4"/>} />
              <Instrument label="Margem Líquida" value={formatPercent(ml)}
                bm={BM.margemLiquida} bmVal={ml}
                color="#F59E0B" icon={<Target className="w-4 h-4"/>} />
            </div>
          </div>

          {/* Desktop: grid 6 colunas */}
          <div className="hidden lg:grid grid-cols-6 gap-3 mb-6">
            <Instrument label="Receita Bruta" value={`R$ ${fmtK(r)}`}
              sub={`${curTxs.length} lançamentos`}
              delta={curDRE&&prevDRE?delta(r,prevDRE.receitaBruta):null}
              color="#3B82F6" icon={<DollarSign className="w-4 h-4"/>} />
            <Instrument label="Lucro Bruto" value={`R$ ${fmtK(lb)}`}
              sub={lb>=0?'positivo':'negativo'}
              delta={curDRE&&prevDRE?delta(lb,prevDRE.lucroBruto):null}
              color={lb>=0?'#10B981':'#EF4444'} icon={<TrendingUp className="w-4 h-4"/>} />
            <Instrument label="Lucro Operacional" value={`R$ ${fmtK(lo)}`}
              delta={curDRE&&prevDRE?delta(lo,prevDRE.lucroOperacional):null}
              color={lo>=0?'#10B981':'#EF4444'} icon={<Activity className="w-4 h-4"/>} />
            <Instrument label="Lucro Líquido" value={`R$ ${fmtK(ll)}`}
              delta={curDRE&&prevDRE?delta(ll,prevDRE.lucroLiquido):null}
              color={ll>=0?'#10B981':'#EF4444'} icon={<Zap className="w-4 h-4"/>} />
            <Instrument label="Margem Bruta" value={formatPercent(mb)}
              bm={BM.margemBruta} bmVal={mb}
              color="#A78BFA" icon={<Percent className="w-4 h-4"/>} />
            <Instrument label="Margem Líquida" value={formatPercent(ml)}
              bm={BM.margemLiquida} bmVal={ml}
              color="#F59E0B" icon={<Target className="w-4 h-4"/>} />
          </div>

          {/* ── PAINEL 2 — Tendência + Canais ── */}
          <div className="mb-4"><SectionLabel>Tendência 12 Meses</SectionLabel></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 lg:mb-6">

            {/* Gráfico tendência */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rec / Desp / Lucro</span>
                <div className="flex items-center gap-2">
                  {[['Rec','#3B82F6'],['Desp','#EF4444'],['Lucro','#10B981']].map(([n,c])=>(
                    <span key={n} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="w-2 h-0.5 inline-block rounded" style={{background:c}}/>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trendData} margin={{top:5,right:5,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="mes" tick={{fontSize:9,fill:'#475569'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v=>fmtK(v*100)} tick={{fontSize:9,fill:'#475569'}} width={42} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={((v: number) => [`R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:2})}`]) as never}
                      contentStyle={{background:'#0F172A',border:'1px solid #1E293B',borderRadius:8,fontSize:11,color:'#CBD5E1'}}
                      labelStyle={{color:'#64748B',fontSize:10,marginBottom:4}}
                    />
                    <Line type="monotone" dataKey="Receita"  stroke="#3B82F6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Lucro"    stroke="#10B981" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center gap-2">
                  <BarChart3 className="w-8 h-8 text-slate-700" />
                  <p className="text-slate-600 text-sm">Sem dados de tendência</p>
                </div>
              )}
            </div>

            {/* Canais — lista rankeada com barra de progresso */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 lg:p-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Receita por Canal</span>
              {chData.length > 0 ? (
                <div className="space-y-3">
                  {chData.map(d => {
                    const total = chData.reduce((s,x)=>s+x.value,0)
                    const pct = total>0?(d.value/total)*100:0
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:d.fill}}/>
                            {d.name}
                          </span>
                          <span className="font-mono text-xs text-slate-400">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:d.fill}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center gap-2">
                  <Radio className="w-7 h-7 text-slate-700" />
                  <p className="text-slate-600 text-xs text-center">Sem canal definido</p>
                </div>
              )}
            </div>
          </div>

          {/* ── PAINEL 3 — Custos + Canal + AOV ── */}
          <div className="mb-4"><SectionLabel>Análise Operacional</SectionLabel></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            {/* Composição custos */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4">Composição dos Custos</span>
              {costData.length > 0 ? (
                <div className="space-y-3">
                  {costData.map(d => {
                    const pct = totalCosts>0?(d.value/totalCosts)*100:0
                    return (
                      <div key={d.name}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{background:d.fill}}/>
                            {d.name}
                          </span>
                          <span className="font-mono text-xs text-slate-300">{formatBRL(d.value)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${pct}%`,background:d.fill}}/>
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-3 mt-1 border-t border-slate-800 flex justify-between">
                    <span className="text-xs text-slate-500">Total de Custos</span>
                    <span className="font-mono text-sm font-bold text-red-400">{formatBRL(totalCosts)}</span>
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-600 text-xs">Sem dados de custo</div>
              )}
            </div>

            {/* Canais detalhados */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4">Performance por Canal</span>
              {chData.length > 0 ? (
                <div className="space-y-2">
                  {chData.map(d => {
                    const total = chData.reduce((s,x)=>s+x.value,0)
                    const pct = total>0?(d.value/total)*100:0
                    return (
                      <div key={d.name} className="bg-slate-800/60 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{background:d.fill}}/>
                            {d.name}
                          </span>
                          <span className="font-mono text-xs text-white font-bold">
                            R$ {d.value.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                          </span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${pct}%`,background:d.fill}}/>
                        </div>
                        <span className="text-xs text-slate-600 mt-0.5 block">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-600 text-xs">Sem dados de canal</div>
              )}
            </div>

            {/* Métricas extras */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Métricas Avançadas</span>

              {/* AOV */}
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400"/>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Ticket Médio (AOV)</span>
                </div>
                <p className="font-mono text-xl font-bold text-white">{curAOV>0?formatBRL(curAOV):'—'}</p>
                {curAOV>0&&prevAOV>0&&(
                  <p className={`text-xs mt-1 font-semibold ${delta(curAOV,prevAOV)!>0?'text-emerald-400':'text-red-400'}`}>
                    {delta(curAOV,prevAOV)!>0?'▲':'▼'} {Math.abs(delta(curAOV,prevAOV)!).toFixed(1)}% vs período anterior
                  </p>
                )}
              </div>

              {/* Receita Líquida */}
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-blue-400"/>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Receita Líquida</span>
                </div>
                <p className="font-mono text-xl font-bold text-white">{curDRE?`R$ ${fmtK(curDRE.receitaLiquida)}`:'—'}</p>
              </div>

              {/* Ratio custos/receita */}
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400"/>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Custo / Receita</span>
                </div>
                <p className="font-mono text-xl font-bold text-white">
                  {curDRE&&r>0?formatPercent((totalCosts/r)*100):'—'}
                </p>
                {curDRE&&r>0&&(
                  <div className="h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-red-500" style={{width:`${Math.min((totalCosts/r)*100,100)}%`}}/>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PAINEL 4 — DRE Cascata ── */}
          <button
            onClick={() => setBmOpen(v => !v)}
            className="lg:hidden w-full flex items-center justify-between mb-2 text-left"
          >
            <SectionLabel>DRE — Cascata de Resultados</SectionLabel>
            {bmOpen ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          </button>
          <div className="hidden lg:block mb-4"><SectionLabel>DRE — Cascata de Resultados</SectionLabel></div>

          <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4 ${!bmOpen ? 'hidden lg:block' : ''}`}>
            {curDRE ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                {[
                  { label:'Receita Bruta',   v:curDRE.receitaBruta,            color:'#3B82F6', op:'' },
                  { label:'(-) Deduções',    v:curDRE.deducoes,                color:'#EF4444', op:'−' },
                  { label:'Rec. Líquida',    v:curDRE.receitaLiquida,          color:'#60A5FA', op:'=' },
                  { label:'(-) CMV',         v:curDRE.cmv,                     color:'#EF4444', op:'−' },
                  { label:'Lucro Bruto',     v:curDRE.lucroBruto,              color:curDRE.lucroBruto>=0?'#10B981':'#EF4444', op:'=' },
                  { label:'(-) Desp. Op.',   v:curDRE.despesasOperacionais,    color:'#F59E0B', op:'−' },
                  { label:'Lucro Op.',       v:curDRE.lucroOperacional,        color:curDRE.lucroOperacional>=0?'#10B981':'#EF4444', op:'=' },
                  { label:'Lucro Líquido',   v:curDRE.lucroLiquido,            color:curDRE.lucroLiquido>=0?'#10B981':'#EF4444', op:'=' },
                ].map(({label,v,color,op},i) => (
                  <div key={label} className={`p-3 lg:p-4 border-r border-b border-slate-800 last:border-r-0 ${i===7?'bg-slate-800/50':''}`}>
                    <div className="h-0.5 rounded-full mb-2" style={{background:color,opacity:0.5}}/>
                    <p className="text-[10px] lg:text-xs text-slate-600 mb-1 leading-tight">{label}</p>
                    <p className="font-mono text-xs lg:text-sm font-bold leading-none" style={{color}}>
                      {op&&<span className="text-slate-600 mr-0.5 text-[10px]">{op}</span>}
                      R$ {fmtK(Math.abs(v))}
                    </p>
                    {r>0&&(
                      <p className="text-[10px] text-slate-700 mt-1">{formatPercent(Math.abs((v/r)*100))}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-2">
                <BarChart3 className="w-8 h-8 text-slate-700"/>
                <p className="text-slate-500 text-sm">Sem transações no período.</p>
                <p className="text-slate-700 text-xs">Adicione lançamentos em Transações ou Importar.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
