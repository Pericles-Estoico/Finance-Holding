import { useState, useMemo } from 'react'
import {
  ChevronRight, ChevronDown, Plus, Trash2, Pencil,
  Download, RefreshCw, Calculator,
} from 'lucide-react'
import { useCorporateChart } from '../hooks/useCorporateChart'
import type { ChartAccountV2, AccountClass } from '../services/corporateChartApi'
import Modal from '../../../components/ui/Modal'

// ──────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────

const CLASS_LABEL: Record<AccountClass, string> = {
  ASSET:     'Ativo',
  LIABILITY: 'Passivo',
  EQUITY:    'Patrimônio Líquido',
  REVENUE:   'Receitas',
  EXPENSE:   'Custos e Despesas',
}

const CLASS_COLOR: Record<AccountClass, string> = {
  ASSET:     'bg-blue-100 text-blue-700',
  LIABILITY: 'bg-purple-100 text-purple-700',
  EQUITY:    'bg-indigo-100 text-indigo-700',
  REVENUE:   'bg-emerald-100 text-emerald-700',
  EXPENSE:   'bg-red-100 text-red-700',
}

const CLASS_ORDER: AccountClass[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
const LABEL_CLS = 'text-xs font-medium text-slate-600 block mb-1'

const CODE_PATTERN = /^\d+(\.\d+){0,4}$/

// ──────────────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────────────

interface AccountNode extends ChartAccountV2 {
  children: AccountNode[]
}

type FilterClass = AccountClass | 'ALL'

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function buildTree(accounts: ChartAccountV2[]): AccountNode[] {
  const map = new Map<string, AccountNode>()
  for (const a of accounts) map.set(a.id, { ...a, children: [] })

  const roots: AccountNode[] = []
  for (const a of accounts) {
    const node = map.get(a.id)!
    if (a.parent_account_id && map.has(a.parent_account_id)) {
      map.get(a.parent_account_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function sort(nodes: AccountNode[]) {
    nodes.sort((a, b) => a.account_code.localeCompare(b.account_code, undefined, { numeric: true }))
    for (const n of nodes) sort(n.children)
  }
  sort(roots)
  return roots
}

function countDescendants(node: AccountNode): number {
  return node.children.reduce((s, c) => s + 1 + countDescendants(c), 0)
}

// ──────────────────────────────────────────────────────────────────────
// AccountRow — linha recursiva da árvore
// ──────────────────────────────────────────────────────────────────────

interface RowProps {
  node: AccountNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (account: ChartAccountV2) => void
  onDelete: (account: ChartAccountV2) => void
}

function AccountRow({ node, depth, expanded, onToggle, onEdit, onDelete }: RowProps) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-2 group hover:bg-slate-50/60 border-b border-gray-50 last:border-0 ${
          node.is_calculated ? 'bg-blue-50/40' : ''
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {/* Toggle */}
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={`shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors ${
            hasChildren ? 'text-slate-400 hover:text-slate-600' : 'text-transparent cursor-default'
          }`}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : null}
        </button>

        {/* Código */}
        <span className="text-xs font-mono text-slate-400 w-20 shrink-0 tabular-nums">
          {node.account_code}
        </span>

        {/* Nome */}
        <span className={`text-sm flex-1 min-w-0 truncate ${node.is_calculated ? 'font-semibold text-blue-700' : 'text-slate-700'}`}>
          {node.account_name}
        </span>

        {/* Badge: calculada */}
        {node.is_calculated && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            <Calculator className="w-3 h-3" /> calculada
          </span>
        )}

        {/* Ações */}
        {!node.is_calculated && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onEdit(node)}
              className="p-1.5 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(node)}
              disabled={hasChildren}
              className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
              title={hasChildren ? 'Possui subcontas — não pode ser desativada' : 'Desativar conta'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isOpen && node.children.map(child => (
        <AccountRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string
}

const EMPTY_FORM = {
  account_code: '',
  account_name: '',
  account_class: 'EXPENSE' as AccountClass,
  account_type: 'expense',
  parent_account_id: null as string | null,
  normal_balance: 'debit' as 'debit' | 'credit',
}

export default function CorporateChartManager({ companyId }: Props) {
  const { accounts, loading, error, seeding, seed, create, update, softDelete } = useCorporateChart(companyId)

  const [filterClass, setFilterClass] = useState<FilterClass>('ALL')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<AccountClass>>(new Set(CLASS_ORDER))

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChartAccountV2 | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

  // Árvore organizada por classe
  const treeByClass = useMemo(() => {
    const filtered = filterClass === 'ALL'
      ? accounts
      : accounts.filter(a => a.account_class === filterClass)
    const tree = buildTree(filtered)

    const byClass: Partial<Record<AccountClass, AccountNode[]>> = {}
    for (const cls of CLASS_ORDER) {
      byClass[cls] = tree.filter(n => n.account_class === cls)
    }
    return byClass
  }, [accounts, filterClass])

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleClass(cls: AccountClass) {
    setExpandedClasses(prev => {
      const next = new Set(prev)
      next.has(cls) ? next.delete(cls) : next.add(cls)
      return next
    })
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditingAccount(null)
    setShowCreateModal(true)
  }

  function openEdit(account: ChartAccountV2) {
    setForm({
      account_code: account.account_code,
      account_name: account.account_name,
      account_class: account.account_class,
      account_type: account.account_type,
      parent_account_id: account.parent_account_id,
      normal_balance: account.normal_balance,
    })
    setFormError(null)
    setEditingAccount(account)
    setShowCreateModal(true)
  }

  async function handleDelete(account: ChartAccountV2) {
    if (!confirm(`Desativar a conta "${account.account_name}"?`)) return
    try {
      await softDelete(account.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao desativar conta')
    }
  }

  async function handleSave() {
    setFormError(null)
    if (!form.account_code.trim()) { setFormError('Código é obrigatório'); return }
    if (!CODE_PATTERN.test(form.account_code.trim())) { setFormError('Código inválido — use o formato N.N.N.N.N (ex: 5.3.2.1)'); return }
    if (!form.account_name.trim()) { setFormError('Nome é obrigatório'); return }

    setSaving(true)
    try {
      if (editingAccount) {
        await update(editingAccount.id, {
          account_name: form.account_name.trim(),
          account_type: form.account_type,
          parent_account_id: form.parent_account_id,
        })
      } else {
        await create({
          account_code: form.account_code.trim(),
          account_name: form.account_name.trim(),
          account_class: form.account_class,
          account_type: form.account_type,
          normal_balance: form.normal_balance,
          parent_account_id: form.parent_account_id,
          level: form.account_code.trim().split('.').length,
          is_calculated: false,
          is_active: true,
          company_id: companyId,
          created_by: null,
        })
      }
      setShowCreateModal(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSeed() {
    setSeedMessage(null)
    const result = await seed()
    setSeedMessage(result.message)
  }

  // Contas disponíveis para selecionar como pai (filtra a classe selecionada)
  const parentOptions = accounts.filter(a => a.account_class === form.account_class && !a.is_calculated)

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Plano de Contas Corporativo IPO/M&A</h3>
          <p className="text-xs text-slate-400 mt-0.5">{accounts.length} contas · 5 classes · padrão IFRS/GAAP</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {seeding
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importando…</>
                : <><Download className="w-3.5 h-3.5" /> Importar Template Corporativo</>
              }
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Conta
          </button>
        </div>
      </div>

      {/* Mensagem seed */}
      {seedMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2 rounded-lg">
          {seedMessage}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Filtro por classe */}
      <div className="flex flex-wrap gap-1.5">
        {(['ALL', ...CLASS_ORDER] as (FilterClass)[]).map(cls => (
          <button
            key={cls}
            onClick={() => setFilterClass(cls)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterClass === cls
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-200 text-slate-500 hover:border-slate-400'
            }`}
          >
            {cls === 'ALL' ? 'Todas' : CLASS_LABEL[cls]}
          </button>
        ))}
      </div>

      {/* Árvore */}
      {accounts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Download className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhuma conta corporativa encontrada.</p>
          <p className="text-slate-300 text-xs mt-1">Clique em "Importar Template Corporativo" para começar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {CLASS_ORDER.map(cls => {
            const nodes = treeByClass[cls] ?? []
            if (filterClass !== 'ALL' && cls !== filterClass) return null
            const isOpen = expandedClasses.has(cls)
            const total = nodes.reduce((s, n) => s + 1 + countDescendants(n), 0)
            if (total === 0 && filterClass !== 'ALL') return null

            return (
              <div key={cls}>
                <button
                  onClick={() => toggleClass(cls)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CLASS_COLOR[cls]}`}>
                    {CLASS_LABEL[cls]}
                  </span>
                  <span className="text-xs text-slate-400">{total} conta{total !== 1 ? 's' : ''}</span>
                </button>
                {isOpen && nodes.map(node => (
                  <AccountRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleNode}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {showCreateModal && (
        <Modal
          title={editingAccount ? 'Editar Conta' : 'Nova Conta'}
          onClose={() => setShowCreateModal(false)}
        >
          <div className="space-y-4">
            {formError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Código *</label>
                <input
                  value={form.account_code}
                  onChange={e => setForm(p => ({ ...p, account_code: e.target.value }))}
                  disabled={!!editingAccount}
                  placeholder="Ex: 5.3.2.1"
                  className={`${INPUT_CLS} font-mono ${editingAccount ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Classe *</label>
                <select
                  value={form.account_class}
                  onChange={e => setForm(p => ({ ...p, account_class: e.target.value as AccountClass, parent_account_id: null }))}
                  disabled={!!editingAccount}
                  className={`${INPUT_CLS} ${editingAccount ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                >
                  {CLASS_ORDER.map(cls => (
                    <option key={cls} value={cls}>{CLASS_LABEL[cls]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Nome da Conta *</label>
              <input
                value={form.account_name}
                onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))}
                placeholder="Ex: Salários e Encargos"
                className={INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Tipo</label>
                <input
                  value={form.account_type}
                  onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}
                  placeholder="Ex: expense, revenue, asset…"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Saldo Normal</label>
                <select
                  value={form.normal_balance}
                  onChange={e => setForm(p => ({ ...p, normal_balance: e.target.value as 'debit' | 'credit' }))}
                  className={INPUT_CLS}
                >
                  <option value="debit">Débito</option>
                  <option value="credit">Crédito</option>
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Conta Pai (opcional)</label>
              <select
                value={form.parent_account_id ?? ''}
                onChange={e => setForm(p => ({ ...p, parent_account_id: e.target.value || null }))}
                className={INPUT_CLS}
              >
                <option value="">— Nenhuma (conta raiz) —</option>
                {parentOptions.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_code} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border border-gray-200 text-slate-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Salvando…' : (editingAccount ? 'Salvar Alterações' : 'Criar Conta')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
