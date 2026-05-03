import { useState, useEffect } from 'react'
import {
  Building2, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  User, BookOpen, Shield, CheckCircle2, BarChart3,
} from 'lucide-react'
import CorporateChartManager from '../features/finance/components/CorporateChartManager'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../lib/api/companies'
import { getAccounts, createAccount, deleteAccount } from '../lib/api/accounts'
import Modal from '../components/ui/Modal'
import type { Company, AccountCategory, TaxRegime } from '../types'

// ─── Constantes ───────────────────────────────────────────────────────────────

type Tab = 'empresas' | 'contas' | 'corporativo' | 'perfil'

const ACCOUNT_TYPE_LABEL: Record<AccountCategory['type'], string> = {
  ativo: 'Ativo', passivo: 'Passivo', receita: 'Receita',
  cmv: 'CMV', despesa_operacional: 'Despesa Operacional', imposto: 'Imposto',
}
const ACCOUNT_TYPE_COLOR: Record<AccountCategory['type'], string> = {
  ativo:              'bg-blue-100   text-blue-700',
  passivo:            'bg-purple-100 text-purple-700',
  receita:            'bg-emerald-100 text-emerald-700',
  cmv:                'bg-orange-100 text-orange-700',
  despesa_operacional:'bg-red-100    text-red-700',
  imposto:            'bg-slate-100  text-slate-600',
}

const INPUT_CLS  = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
const LABEL_CLS  = 'text-xs font-medium text-slate-600 block mb-1'

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const { refreshCompanies } = useCompany()

  const [tab, setTab]                     = useState<Tab>('empresas')
  const [companies, setCompanies]         = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [accounts, setAccounts]           = useState<AccountCategory[]>([])
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['receita','cmv','despesa_operacional','imposto']))
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [saved]                            = useState(false)

  const [companyForm, setCompanyForm] = useState({ name: '', cnpj: '', tax_regime: 'simples_nacional' as TaxRegime })
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'despesa_operacional' as AccountCategory['type'] })

  useEffect(() => { if (user) loadCompanies() }, [user])
  useEffect(() => { if (selectedCompany) loadAccounts(selectedCompany.id) }, [selectedCompany])

  async function loadCompanies() {
    const data = await getCompanies(user!.id)
    setCompanies(data)
    if (data.length > 0 && !selectedCompany) setSelectedCompany(data[0])
  }
  async function loadAccounts(id: string) { setAccounts(await getAccounts(id)) }

  async function handleSaveCompany() {
    setError(null); setLoading(true)
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
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro ao salvar empresa') }
    setLoading(false)
  }

  async function handleDeleteCompany(id: string) {
    if (!confirm('Deletar empresa e todos os seus dados?')) return
    await deleteCompany(id); await loadCompanies(); await refreshCompanies()
    if (selectedCompany?.id === id) setSelectedCompany(null)
  }

  async function handleSaveAccount() {
    if (!selectedCompany) return
    setError(null); setLoading(true)
    try {
      await createAccount({ ...accountForm, company_id: selectedCompany.id, is_system: false })
      await loadAccounts(selectedCompany.id)
      setShowAccountModal(false)
      setAccountForm({ code: '', name: '', type: 'despesa_operacional' })
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro ao salvar conta') }
    setLoading(false)
  }

  async function handleDeleteAccount(id: string, isSystem: boolean) {
    if (isSystem && !confirm('Esta é uma conta do sistema. Deseja realmente deletar?')) return
    await deleteAccount(id)
    if (selectedCompany) await loadAccounts(selectedCompany.id)
  }

  function toggleType(type: string) {
    setExpandedTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })
  }

  const accountsByType = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountCategory['type'][])
    .map(type => ({ type, items: accounts.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0)

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'empresas',    label: 'Empresas',         icon: <Building2 className="w-4 h-4" /> },
    { key: 'contas',      label: 'Plano Básico',      icon: <BookOpen className="w-4 h-4" /> },
    { key: 'corporativo', label: 'Plano Corporativo', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'perfil',      label: 'Perfil',            icon: <User className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configurações</h2>
        <p className="text-slate-400 text-xs mt-0.5">Gerencie empresas, plano de contas e seu perfil</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab===t.key?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: EMPRESAS ─── */}
      {tab === 'empresas' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Empresas / CNPJs</h3>
              <p className="text-xs text-slate-400 mt-0.5">{companies.length} empresa{companies.length !== 1 ? 's' : ''} cadastrada{companies.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => { setEditingCompany(null); setCompanyForm({ name:'', cnpj:'', tax_regime:'simples_nacional' }); setError(null); setShowCompanyModal(true) }}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Nova Empresa
            </button>
          </div>

          {companies.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-xl border border-gray-100">
              <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhuma empresa cadastrada.</p>
              <p className="text-slate-300 text-xs mt-1">Clique em "Nova Empresa" para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map(c => (
                <div key={c.id}
                  onClick={() => { setSelectedCompany(c); setTab('contas') }}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
                      <Building2 className="text-white w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{c.cnpj} · {c.tax_regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingCompany(c); setCompanyForm({ name:c.name, cnpj:c.cnpj, tax_regime:c.tax_regime }); setError(null); setShowCompanyModal(true) }}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCompany(c.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── TAB: PLANO DE CONTAS ─── */}
      {tab === 'contas' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Plano de Contas</h3>
              <p className="text-xs text-slate-400 mt-0.5">{accounts.length} contas · {selectedCompany?.name ?? 'selecione uma empresa'}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Seletor de empresa */}
              <select
                value={selectedCompany?.id ?? ''}
                onChange={e => { const c = companies.find(x => x.id === e.target.value); if (c) setSelectedCompany(c) }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCompany && (
                <button
                  onClick={() => { setError(null); setShowAccountModal(true) }}
                  className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Nova Conta
                </button>
              )}
            </div>
          </div>

          {!selectedCompany ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Selecione uma empresa acima.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {accountsByType.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">Nenhuma conta encontrada.</p>
              ) : (
                accountsByType.map(({ type, items }) => (
                  <div key={type} className="border-b border-gray-50 last:border-0">
                    <button onClick={() => toggleType(type)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        {expandedTypes.has(type)
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ACCOUNT_TYPE_COLOR[type as AccountCategory['type']]}`}>
                          {ACCOUNT_TYPE_LABEL[type as AccountCategory['type']]}
                        </span>
                        <span className="text-xs text-slate-400">{items.length} conta{items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                    {expandedTypes.has(type) && (
                      <div className="pb-1">
                        {items.map(acc => (
                          <div key={acc.id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50/60 group">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400 w-14 shrink-0 tabular-nums">{acc.code}</span>
                              <span className="text-sm text-slate-700">{acc.name}</span>
                              {acc.is_system && (
                                <span className="text-xs text-slate-300 flex items-center gap-0.5">
                                  <Shield className="w-3 h-3" /> sistema
                                </span>
                              )}
                            </div>
                            {!acc.is_system && (
                              <button onClick={() => handleDeleteAccount(acc.id, acc.is_system)}
                                className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── TAB: PLANO CORPORATIVO ─── */}
      {tab === 'corporativo' && (
        <section className="space-y-4">
          {!selectedCompany ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <BarChart3 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Selecione uma empresa na aba Empresas para gerenciar o plano corporativo.</p>
            </div>
          ) : (
            <CorporateChartManager companyId={selectedCompany.id} />
          )}
        </section>
      )}

      {/* ─── TAB: PERFIL ─── */}
      {tab === 'perfil' && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Meu Perfil</h3>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
              <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{user?.user_metadata?.full_name ?? 'Usuário'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Conta verificada
                </p>
              </div>
            </div>

            {/* Campos de info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>E-mail</label>
                <input value={user?.email ?? ''} readOnly
                  className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`} />
              </div>
              <div>
                <label className={LABEL_CLS}>ID do usuário</label>
                <input value={user?.id ? user.id.slice(0, 16) + '…' : ''} readOnly
                  className={`${INPUT_CLS} font-mono bg-slate-50 text-slate-500 cursor-not-allowed`} />
              </div>
              <div>
                <label className={LABEL_CLS}>Criado em</label>
                <input
                  value={user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
                  readOnly className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`} />
              </div>
              <div>
                <label className={LABEL_CLS}>Último acesso</label>
                <input
                  value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}
                  readOnly className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`} />
              </div>
            </div>
          </div>

          {/* Zona perigosa */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-red-700 mb-1">Zona de Risco</h4>
            <p className="text-xs text-red-500 mb-3">Ações permanentes e irreversíveis.</p>
            <button className="text-xs font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
              Excluir minha conta
            </button>
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Salvo com sucesso</span>
            </div>
          )}
        </section>
      )}

      {/* ─── Modal Empresa ─── */}
      {showCompanyModal && (
        <Modal title={editingCompany ? 'Editar Empresa' : 'Nova Empresa'} onClose={() => { setShowCompanyModal(false); setError(null) }}>
          <div className="space-y-4">
            {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className={LABEL_CLS}>Nome da Empresa *</label>
              <input value={companyForm.name} onChange={e => setCompanyForm(p=>({...p,name:e.target.value}))}
                className={INPUT_CLS} placeholder="Ex: Minha Empresa Ltda" />
            </div>
            <div>
              <label className={LABEL_CLS}>CNPJ *</label>
              <input value={companyForm.cnpj} onChange={e => setCompanyForm(p=>({...p,cnpj:e.target.value}))}
                className={INPUT_CLS} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className={LABEL_CLS}>Regime Tributário</label>
              <select value={companyForm.tax_regime} onChange={e => setCompanyForm(p=>({...p,tax_regime:e.target.value as TaxRegime}))}
                className={INPUT_CLS}>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowCompanyModal(false); setError(null) }}
                className="flex-1 border border-gray-200 text-slate-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveCompany} disabled={loading||!companyForm.name||!companyForm.cnpj}
                className="flex-1 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {loading?'Salvando…':'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Modal Conta ─── */}
      {showAccountModal && (
        <Modal title="Nova Conta" onClose={() => { setShowAccountModal(false); setError(null) }}>
          <div className="space-y-4">
            {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Código *</label>
                <input value={accountForm.code} onChange={e => setAccountForm(p=>({...p,code:e.target.value}))}
                  className={`${INPUT_CLS} font-mono`} placeholder="3.1.3" />
              </div>
              <div>
                <label className={LABEL_CLS}>Tipo *</label>
                <select value={accountForm.type} onChange={e => setAccountForm(p=>({...p,type:e.target.value as AccountCategory['type']}))}
                  className={INPUT_CLS}>
                  {(Object.entries(ACCOUNT_TYPE_LABEL) as [AccountCategory['type'],string][]).map(([k,v])=>(
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Nome da Conta *</label>
              <input value={accountForm.name} onChange={e => setAccountForm(p=>({...p,name:e.target.value}))}
                className={INPUT_CLS} placeholder="Ex: Parcelas — Máquinas e Equipamentos" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowAccountModal(false); setError(null) }}
                className="flex-1 border border-gray-200 text-slate-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSaveAccount} disabled={loading||!accountForm.code||!accountForm.name}
                className="flex-1 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {loading?'Salvando…':'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
