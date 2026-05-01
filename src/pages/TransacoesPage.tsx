import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, Filter, FileSpreadsheet } from 'lucide-react'
import { exportTransacoesCSV } from '../lib/export/csv'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../lib/api/transactions'
import { getAccounts } from '../lib/api/accounts'
import { formatBRL } from '../lib/currency'
import Modal from '../components/ui/Modal'
import type { Transaction, AccountCategory, SaleChannel } from '../types'

const CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: 'amazon',        label: 'Amazon' },
  { value: 'shopify',       label: 'Shopify' },
  { value: 'varejo_fisico', label: 'Varejo Físico' },
  { value: 'b2b',           label: 'B2B' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'outros',        label: 'Outros' },
]

const emptyForm = {
  company_id: '',
  account_id: '',
  type: 'despesa' as 'receita' | 'despesa',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  channel: '' as SaleChannel | '',
}

const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
const LABEL_CLS = 'text-xs font-medium text-slate-600 block mb-1'

export default function TransacoesPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts]         = useState<AccountCategory[]>([])
  const [allAccounts, setAllAccounts]   = useState<AccountCategory[]>([])
  const [showModal, setShowModal]       = useState(false)
  const [editingTx, setEditingTx]       = useState<Transaction | null>(null)
  const [form, setForm]                 = useState(emptyForm)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [filterType, setFilterType]     = useState<'todos' | 'receita' | 'despesa'>('todos')

  const companyIds = activeCompanyId === 'consolidated'
    ? companies.map(c => c.id)
    : [activeCompanyId]

  useEffect(() => {
    if (companyIds.length > 0) loadTransactions()
  }, [activeCompanyId, isSimulation])

  useEffect(() => {
    if (form.company_id) loadAccounts(form.company_id)
  }, [form.company_id])

  const loadTransactions = async () => {
    if (!companyIds.length) return
    const [data, accs] = await Promise.all([
      getTransactions({ companyIds, isSimulation }),
      Promise.all(companyIds.map(id => getAccounts(id))).then(r => r.flat()),
    ])
    setTransactions(data)
    setAllAccounts(accs)
  }

  const loadAccounts = async (companyId: string) => {
    const data = await getAccounts(companyId)
    setAccounts(data)
  }

  const openNew = () => {
    setEditingTx(null)
    setForm({ ...emptyForm, company_id: activeCompanyId !== 'consolidated' ? activeCompanyId : (companies[0]?.id ?? '') })
    setError(null)
    setShowModal(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setForm({
      company_id: tx.company_id,
      account_id: tx.account_id,
      type: tx.type,
      amount: (tx.amount_cents / 100).toFixed(2),
      description: tx.description,
      date: tx.date,
      channel: (tx.channel ?? '') as SaleChannel | '',
    })
    setError(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    setError(null)
    if (!form.company_id || !form.account_id || !form.amount || !form.description || !form.date) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        company_id:    form.company_id,
        account_id:    form.account_id,
        type:          form.type,
        amount:        form.amount,
        description:   form.description,
        date:          form.date,
        channel:       form.channel || undefined,
        is_simulation: isSimulation,
      }
      if (editingTx) {
        await updateTransaction(editingTx.id, payload)
      } else {
        await createTransaction(payload)
      }
      await loadTransactions()
      setShowModal(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar transação')
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar esta transação?')) return
    await deleteTransaction(id)
    await loadTransactions()
  }

  const filtered      = filterType === 'todos' ? transactions : transactions.filter(t => t.type === filterType)
  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount_cents, 0)
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount_cents, 0)
  const saldo         = totalReceitas - totalDespesas
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name ?? '—'
  const allAccountMap = useMemo(() => new Map(allAccounts.map(a => [a.id, a])), [allAccounts])
  const companyMap    = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Transações</h2>
          <p className="text-slate-400 text-xs mt-0.5">Lançamentos financeiros da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          {transactions.length > 0 && (
            <button
              onClick={() => exportTransacoesCSV(filtered, allAccountMap, companyMap)}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </button>
          )}
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nova Transação
          </button>
        </div>
      </div>

      {/* KPI resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Receitas',  value: totalReceitas,        color: 'text-emerald-600' },
          { label: 'Total Despesas',  value: totalDespesas,        color: 'text-red-500' },
          { label: 'Saldo Período',   value: Math.abs(saldo),      color: saldo >= 0 ? 'text-blue-700' : 'text-red-600', prefix: saldo < 0 ? '−' : '' },
        ].map(({ label, value, color, prefix }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</p>
            <p className={`font-mono text-xl font-semibold leading-none ${color}`}>{prefix}{formatBRL(value)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {(['todos', 'receita', 'despesa'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${filterType === f ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-slate-50'}`}>
            {f === 'todos' ? 'Todos' : f === 'receita' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-slate-400 text-sm">Nenhuma transação encontrada.</p>
            <p className="text-slate-300 text-xs mt-1">Clique em "Nova Transação" para começar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">Canal</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {tx.type === 'receita'
                        ? <ArrowUpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      <span className="text-slate-800 text-sm">{tx.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{getCompanyName(tx.company_id)}</td>
                  <td className="px-4 py-3">
                    {tx.channel && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {CHANNELS.find(c => c.value === tx.channel)?.label ?? tx.channel}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.type === 'receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'despesa' ? '− ' : '+ '}{formatBRL(tx.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => openEdit(tx)} className="p-1.5 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(tx.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editingTx ? 'Editar Transação' : 'Nova Transação'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Tipo *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'receita' | 'despesa' }))}
                  className={INPUT_CLS}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Data *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className={INPUT_CLS} />
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Empresa *</label>
              <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, account_id: '' }))}
                className={INPUT_CLS}>
                <option value="">Selecione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Conta do Plano *</label>
              <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                className={INPUT_CLS} disabled={!form.company_id}>
                <option value="">Selecione a conta...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Descrição *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className={INPUT_CLS} placeholder="Ex: Venda marketplace março" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Valor (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className={INPUT_CLS} placeholder="0,00" />
              </div>
              <div>
                <label className={LABEL_CLS}>Canal de Venda</label>
                <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value as SaleChannel | '' }))}
                  className={INPUT_CLS}>
                  <option value="">— Nenhum —</option>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-slate-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
