import { useState } from 'react'
import { Plus, Edit2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import type { ChartAccount } from '../types/finance.types'

interface Props {
  accounts: ChartAccount[]
  onSeed: () => void
  onCreate: (payload: Omit<ChartAccount, 'id' | 'created_at' | 'updated_at'>) => void
  onUpdate: (id: string, payload: Partial<ChartAccount>) => void
  companyId: string
  loading?: boolean
}

function fmtGroup(g: string | null): string {
  if (!g) return '—'
  return g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ChartAccountsManager({
  accounts,
  onSeed,
  onCreate: _onCreate,
  onUpdate,
  loading = false,
}: Props) {
  const [showInactive, setShowInactive] = useState(false)

  const displayed = showInactive ? accounts : accounts.filter((a) => a.is_active)
  const grouped = displayed.reduce<Record<number, ChartAccount[]>>((acc, a) => {
    if (!acc[a.level]) acc[a.level] = []
    acc[a.level].push(a)
    return acc
  }, {})

  const roots = (grouped[1] ?? []).sort((a, b) => a.code.localeCompare(b.code))

  function getChildren(parentId: string) {
    return (grouped[2] ?? []).filter((a) => a.parent_id === parentId).sort((a, b) => a.code.localeCompare(b.code))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Plano de Contas Executivo</h2>
          <p className="text-xs text-gray-500">{accounts.length} contas cadastradas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showInactive ? 'Ocultar inativos' : 'Ver inativos'}
          </button>
          {accounts.length === 0 && (
            <button
              onClick={onSeed}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Criar Seed Padrão
            </button>
          )}
        </div>
      </div>

      {accounts.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Plus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Nenhuma conta cadastrada</p>
          <p className="text-gray-400 text-xs mt-1">Clique em "Criar Seed Padrão" para popular o plano de contas</p>
        </div>
      )}

      {roots.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Grupo DRE</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Grupo EBITDA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roots.map((root) => (
                <>
                  <tr key={root.id} className="bg-gray-50/80">
                    <td className="px-4 py-2 font-bold text-gray-700">{root.code}</td>
                    <td className="px-4 py-2 font-bold text-gray-800">{root.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtGroup(root.account_type)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtGroup(root.dre_group)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtGroup(root.ebitda_group)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => onUpdate(root.id, { is_active: !root.is_active })}
                        className={`p-1 rounded text-xs ${root.is_active ? 'text-gray-400 hover:text-red-500' : 'text-gray-300 hover:text-emerald-500'} transition-colors`}
                        title={root.is_active ? 'Inativar' : 'Ativar'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {getChildren(root.id).map((child) => (
                    <tr key={child.id} className={child.is_active ? 'bg-white' : 'bg-gray-50 opacity-50'}>
                      <td className="px-4 py-2 pl-8 text-gray-500">{child.code}</td>
                      <td className="px-4 py-2 pl-8 text-gray-700">{child.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{fmtGroup(child.account_type)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{fmtGroup(child.dre_group)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{fmtGroup(child.ebitda_group)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => onUpdate(child.id, { is_active: !child.is_active })}
                          className={`p-1 rounded text-xs ${child.is_active ? 'text-gray-400 hover:text-red-500' : 'text-gray-300 hover:text-emerald-500'} transition-colors`}
                          title={child.is_active ? 'Inativar' : 'Ativar'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
