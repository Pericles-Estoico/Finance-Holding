import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../lib/api/transactions'
import { getAccounts } from '../lib/api/accounts'
import { formatBRL } from '../lib/currency'
import Modal from '../components/ui/Modal'
import type { Transaction, AccountCategory, SaleChannel } from '../types'

const CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'varejo_fisico', label: 'Varejo Físico' },
  { value: 'b2b', label: 'B2B' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'outros', label: 'Outros' },
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

export default function TransacoesPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<AccountCategory[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos')

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
    const data = await getTransactions({ companyIds, isSimulation })
    setTransactions(data)
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
        company_id: form.company_id,
        account_id: form.account_id,
        type: form.type,
        amount: form.amount,
        description: form.description,
        date: form.date,
        channel: form.channel || undefined,
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

  const filtered = filterType === 'todos' ? transactions : transactions.filter(t => t.type === filterType)

  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount_cents, 0)
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount_cents, 0)
  const saldo = totalReceitas - totalDespesas

  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name ?? '—'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Transações</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nova Transação
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Receitas', value: totalReceitas, color: 'text-green-600' },
          { label: 'Total Despesas', value: totalDespesas, color: 'text-red-500' },
          { label: 'Saldo', value: saldo, color: saldo >= 0 ? 'text-blue-700' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{formatBRL(Math.abs(value))}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['todos', 'receita', 'despesa'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${filterType === f ? 'bg-blue-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f === 'todos' ? 'Todos' : f === 'receita' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Nenhuma transação encontrada.</p>
            <p className="text-gray-300 text-xs mt-1">Clique em "Nova Transação" para começar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">Canal</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {tx.type === 'receita'
                        ? <ArrowUpCircle className="w-4 h-4 text-green-500 shrink-0" />
                        : <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      <span className="text-gray-800">{tx.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{getCompanyName(tx.company_id)}</td>
                  <td className="px-4 py-3">
                    {tx.channel && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                        {CHANNELS.find(c => c.value === tx.channel)?.label ?? tx.channel}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'despesa' ? '- ' : '+ '}{formatBRL(tx.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(tx)} className="p-1.5 text-gray-300 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tipo *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'receita' | 'despesa' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Data *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Empresa *</label>
              <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, account_id: '' }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Conta do Plano *</label>
              <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!form.company_id}>
                <option value="">Selecione a conta...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Descrição *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Venda marketplace março" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Valor (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Canal de Venda</label>
                <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value as SaleChannel | '' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Nenhum —</option>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
