import { useState, useEffect } from 'react'
import { Building2, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../lib/api/companies'
import { getAccounts, createAccount, deleteAccount } from '../lib/api/accounts'
import Modal from '../components/ui/Modal'
import type { Company, AccountCategory, TaxRegime } from '../types'

const ACCOUNT_TYPE_LABEL: Record<AccountCategory['type'], string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  receita: 'Receita',
  cmv: 'CMV',
  despesa_operacional: 'Despesa Operacional',
  imposto: 'Imposto',
}
const ACCOUNT_TYPE_COLOR: Record<AccountCategory['type'], string> = {
  ativo: 'bg-blue-100 text-blue-700',
  passivo: 'bg-purple-100 text-purple-700',
  receita: 'bg-green-100 text-green-700',
  cmv: 'bg-orange-100 text-orange-700',
  despesa_operacional: 'bg-red-100 text-red-700',
  imposto: 'bg-gray-100 text-gray-700',
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const { refreshCompanies } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [accounts, setAccounts] = useState<AccountCategory[]>([])
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['receita', 'cmv', 'despesa_operacional', 'imposto']))
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [companyForm, setCompanyForm] = useState({ name: '', cnpj: '', tax_regime: 'simples_nacional' as TaxRegime })
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'despesa_operacional' as AccountCategory['type'] })

  useEffect(() => {
    if (user) loadCompanies()
  }, [user])

  useEffect(() => {
    if (selectedCompany) loadAccounts(selectedCompany.id)
  }, [selectedCompany])

  const loadCompanies = async () => {
    const data = await getCompanies(user!.id)
    setCompanies(data)
    if (data.length > 0 && !selectedCompany) setSelectedCompany(data[0])
  }

  const loadAccounts = async (companyId: string) => {
    const data = await getAccounts(companyId)
    setAccounts(data)
  }

  const handleSaveCompany = async () => {
    setError(null)
    setLoading(true)
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, companyForm)
      } else {
        await createCompany({ ...companyForm, user_id: user!.id })
      }
      await loadCompanies()
      await refreshCompanies()
      setShowCompanyModal(false)
      setEditingCompany(null)
      setCompanyForm({ name: '', cnpj: '', tax_regime: 'simples_nacional' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar empresa')
    }
    setLoading(false)
  }

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Deletar empresa e todos os seus dados?')) return
    await deleteCompany(id)
    await loadCompanies()
    await refreshCompanies()
    if (selectedCompany?.id === id) setSelectedCompany(null)
  }

  const handleSaveAccount = async () => {
    if (!selectedCompany) return
    setError(null)
    setLoading(true)
    try {
      await createAccount({ ...accountForm, company_id: selectedCompany.id, is_system: false })
      await loadAccounts(selectedCompany.id)
      setShowAccountModal(false)
      setAccountForm({ code: '', name: '', type: 'despesa_operacional' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar conta')
    }
    setLoading(false)
  }

  const handleDeleteAccount = async (id: string, isSystem: boolean) => {
    if (isSystem && !confirm('Esta é uma conta do sistema. Deseja realmente deletar?')) return
    await deleteAccount(id)
    if (selectedCompany) await loadAccounts(selectedCompany.id)
  }

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const accountsByType = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountCategory['type'][]).map(type => ({
    type,
    items: accounts.filter(a => a.type === type),
  })).filter(g => g.items.length > 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Empresas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Empresas / CNPJs</h2>
          <button
            onClick={() => { setEditingCompany(null); setCompanyForm({ name: '', cnpj: '', tax_regime: 'simples_nacional' }); setShowCompanyModal(true) }}
            className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Empresa
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma empresa cadastrada.</p>
            <p className="text-gray-400 text-xs mt-1">Crie uma empresa para começar.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {companies.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCompany(c)}
                className={`flex items-center justify-between p-4 bg-white rounded-xl border cursor-pointer transition-all ${selectedCompany?.id === c.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
                    <Building2 className="text-white w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <p className="text-gray-400 text-xs">{c.cnpj} · {c.tax_regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditingCompany(c); setCompanyForm({ name: c.name, cnpj: c.cnpj, tax_regime: c.tax_regime }); setShowCompanyModal(true) }}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  ><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteCompany(c.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Plano de Contas */}
      {selectedCompany && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Plano de Contas</h2>
              <p className="text-gray-400 text-xs mt-0.5">{selectedCompany.name}</p>
            </div>
            <button
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova Conta
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {accountsByType.map(({ type, items }) => (
              <div key={type} className="border-b border-gray-50 last:border-0">
                <button
                  onClick={() => toggleType(type)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedTypes.has(type) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_TYPE_COLOR[type as AccountCategory['type']]}`}>
                      {ACCOUNT_TYPE_LABEL[type as AccountCategory['type']]}
                    </span>
                    <span className="text-xs text-gray-400">{items.length} contas</span>
                  </div>
                </button>
                {expandedTypes.has(type) && (
                  <div className="pb-2">
                    {items.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-gray-400 w-14 shrink-0">{acc.code}</span>
                          <span className="text-sm text-gray-700">{acc.name}</span>
                          {acc.is_system && <span className="text-xs text-gray-300">sistema</span>}
                        </div>
                        {!acc.is_system && (
                          <button
                            onClick={() => handleDeleteAccount(acc.id, acc.is_system)}
                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma conta encontrada.</p>
            )}
          </div>
        </section>
      )}

      {/* Modal Empresa */}
      {showCompanyModal && (
        <Modal title={editingCompany ? 'Editar Empresa' : 'Nova Empresa'} onClose={() => setShowCompanyModal(false)}>
          <div className="space-y-4">
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome da Empresa</label>
              <input value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Minha Empresa Ltda" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">CNPJ</label>
              <input value={companyForm.cnpj} onChange={e => setCompanyForm(p => ({ ...p, cnpj: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Regime Tributário</label>
              <select value={companyForm.tax_regime} onChange={e => setCompanyForm(p => ({ ...p, tax_regime: e.target.value as TaxRegime }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="simples_nacional">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCompanyModal(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveCompany} disabled={loading || !companyForm.name || !companyForm.cnpj}
                className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Conta */}
      {showAccountModal && (
        <Modal title="Nova Conta" onClose={() => setShowAccountModal(false)}>
          <div className="space-y-4">
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Código</label>
              <input value={accountForm.code} onChange={e => setAccountForm(p => ({ ...p, code: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 3.1.3" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome da Conta</label>
              <input value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Publicidade Paga" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
              <select value={accountForm.type} onChange={e => setAccountForm(p => ({ ...p, type: e.target.value as AccountCategory['type'] }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(Object.entries(ACCOUNT_TYPE_LABEL) as [AccountCategory['type'], string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAccountModal(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveAccount} disabled={loading || !accountForm.code || !accountForm.name}
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
