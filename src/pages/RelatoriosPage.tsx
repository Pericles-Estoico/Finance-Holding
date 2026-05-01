import { useState, useEffect, useMemo } from 'react'
import {
  FileText, Download, Table2, BarChart3,
  FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions } from '../lib/api/transactions'
import { getAccounts } from '../lib/api/accounts'
import { calcDRE } from '../lib/dre'
import { gerarDREPDF, gerarTransacoesPDF, gerarResumoExecutivoPDF } from '../lib/export/pdf'
import { exportTransacoesCSV, exportDRECSV } from '../lib/export/csv'
import type { Transaction, AccountCategory, Company } from '../types'

// ─── Período ─────────────────────────────────────────────────────────────────

type Period = 'mes_atual' | 'trimestre' | 'ano_atual' | 'custom'
const PERIOD_LABELS: Record<Period, string> = {
  mes_atual: 'Este mês', trimestre: 'Este trimestre', ano_atual: 'Este ano', custom: 'Personalizado',
}

function getRange(p: Period, f: string, t: string) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth()
  if (p === 'mes_atual') return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` }
  if (p === 'trimestre') { const q=Math.floor(m/3); return { from:`${y}-${String(q*3+1).padStart(2,'0')}-01`, to:`${y}-${String(Math.min(q*3+3,12)).padStart(2,'0')}-30` } }
  if (p === 'ano_atual') return { from:`${y}-01-01`, to:`${y}-12-31` }
  return { from: f, to: t }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface ReportCardProps {
  icon: React.ReactNode
  title: string
  description: string
  stats?: string
  onPDF?: () => void
  onCSV?: () => void
  loading?: boolean
  disabled?: boolean
}

function ReportCard({ icon, title, description, stats, onPDF, onCSV, loading, disabled }: ReportCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
          {stats && (
            <p className="text-xs font-medium text-slate-500 mt-1.5 bg-slate-50 px-2 py-1 rounded-md inline-block">{stats}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-1 border-t border-gray-50">
        {onPDF && (
          <button
            onClick={onPDF}
            disabled={disabled || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Download PDF
          </button>
        )}
        {onCSV && (
          <button
            onClick={onCSV}
            disabled={disabled || loading}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold py-2.5 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  const [period, setPeriod]         = useState<Period>('mes_atual')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts]         = useState<AccountCategory[]>([])

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : activeCompanyId ? [activeCompanyId] : []

  useEffect(() => { loadData() }, [activeCompanyId, period, customFrom, customTo, isSimulation])

  async function loadData() {
    if (!companyIds.length) return
    setLoading(true)
    try {
      const { from, to } = getRange(period, customFrom, customTo)
      const accs = await Promise.all(companyIds.map(id => getAccounts(id))).then(r => r.flat())
      const txs  = await getTransactions({ companyIds, isSimulation, dateFrom: from, dateTo: to })
      setAccounts(accs)
      setTransactions(txs)
    } finally { setLoading(false) }
  }

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])
  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? null

  const dre = useMemo(
    () => accounts.length ? calcDRE(transactions, accounts) : null,
    [transactions, accounts],
  )

  const { from, to } = getRange(period, customFrom, customTo)
  const periodStr = `${from} a ${to}`
  const noData = !dre || transactions.length === 0

  async function run(key: string, fn: () => void) {
    setGenerating(key)
    await new Promise(r => setTimeout(r, 100)) // yield para o spinner aparecer
    try { fn(); setLastGenerated(key) }
    finally { setGenerating(null) }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
          <p className="text-slate-400 text-xs mt-0.5">Gere relatórios profissionais em PDF ou exporte dados em CSV</p>
        </div>
        {lastGenerated && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold">Relatório gerado com sucesso</span>
          </div>
        )}
      </div>

      {/* Período */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Período dos Relatórios</p>
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${period===p?'bg-slate-900 text-white':'bg-slate-50 border border-gray-200 text-slate-600 hover:bg-slate-100'}`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-xs">até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Empresa: <strong className="text-slate-600">{activeCompanyId === 'consolidated' ? 'Visão Consolidada' : (activeCompany?.name ?? '—')}</strong></span>
          <span>·</span>
          <span>{transactions.length} lançamentos encontrados</span>
          {noData && <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3 h-3" /> Sem dados no período</span>}
        </div>
      </div>

      {/* Cards de relatórios */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Relatórios Disponíveis</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <ReportCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="DRE Completo"
            description="Demonstração do Resultado do Exercício com drill-down por conta, margens e benchmarks do setor."
            stats={dre ? `Receita: ${(dre.receitaBruta/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · Margem: ${dre.margemLiquida.toFixed(1)}%` : undefined}
            onPDF={() => run('dre-pdf', () => gerarDREPDF(dre!, activeCompany, periodStr))}
            onCSV={() => run('dre-csv', () => exportDRECSV(dre!.lines))}
            loading={generating === 'dre-pdf' || generating === 'dre-csv'}
            disabled={noData}
          />

          <ReportCard
            icon={<Table2 className="w-5 h-5" />}
            title="Relatório de Transações"
            description="Todos os lançamentos do período com data, descrição, conta, canal e valor. Ideal para auditorias."
            stats={`${transactions.length} lançamentos · ${transactions.filter(t=>t.type==='receita').length} receitas · ${transactions.filter(t=>t.type==='despesa').length} despesas`}
            onPDF={() => run('tx-pdf', () => gerarTransacoesPDF(transactions, accountMap, companyMap, periodStr))}
            onCSV={() => run('tx-csv', () => exportTransacoesCSV(transactions, accountMap, companyMap))}
            loading={generating === 'tx-pdf' || generating === 'tx-csv'}
            disabled={transactions.length === 0}
          />

          <ReportCard
            icon={<FileText className="w-5 h-5" />}
            title="Resumo Executivo"
            description="Relatório de 1 página para reuniões: KPIs principais, cascata de resultados e receita por canal."
            stats={dre ? `Lucro Líquido: ${(dre.lucroLiquido/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : undefined}
            onPDF={() => run('exec-pdf', () => gerarResumoExecutivoPDF(dre!, activeCompany, periodStr))}
            loading={generating === 'exec-pdf'}
            disabled={noData}
          />

        </div>
      </div>

      {/* Dica */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Download className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Sobre os relatórios</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            PDFs são gerados localmente no seu navegador — nenhum dado sai do seu computador.
            O CSV exporta em formato UTF-8 com BOM, compatível com Excel e Google Sheets.
            Para relatórios de múltiplas empresas, selecione "Visão Consolidada" no seletor de empresa.
          </p>
        </div>
      </div>

    </div>
  )
}
