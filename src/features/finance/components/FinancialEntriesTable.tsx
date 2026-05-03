import { useState } from 'react'
import { Edit2, CheckCircle, XCircle } from 'lucide-react'
import type { FinancialEntry, ChartAccount, EntryType, EntryStatus } from '../types/finance.types'

interface Props {
  entries: FinancialEntry[]
  chartAccounts: ChartAccount[]
  onEdit: (entry: FinancialEntry) => void
  onMarkPaid: (entry: FinancialEntry) => void
  onCancel: (entry: FinancialEntry) => void
  filterType?: EntryType | 'all'
}

const statusLabels: Record<EntryStatus, string> = {
  draft: 'Rascunho',
  open: 'Em aberto',
  paid: 'Pago',
  received: 'Recebido',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  partially_paid: 'Parcial',
}

const statusColors: Record<EntryStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  received: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400 line-through',
  partially_paid: 'bg-amber-100 text-amber-700',
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function FinancialEntriesTable({
  entries,
  chartAccounts,
  onEdit,
  onMarkPaid,
  onCancel,
  filterType = 'all',
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function getAccountName(id: string) {
    return chartAccounts.find((a) => a.id === id)?.name ?? '-'
  }

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false
    if (fromDate && e.competence_date < fromDate) return false
    if (toDate && e.competence_date > toDate) return false
    return true
  })

  const totalReceivable = filtered.filter((e) => e.type === 'receivable').reduce((s, e) => s + e.amount, 0)
  const totalPayable = filtered.filter((e) => e.type === 'payable').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos status</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">até</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Competência</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Conta</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            )}
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-600">{fmtDate(entry.competence_date)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(entry.due_date)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{entry.description}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{getAccountName(entry.chart_account_id)}</td>
                <td className={`px-4 py-3 text-right font-semibold font-mono ${entry.type === 'receivable' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {entry.type === 'payable' ? '-' : '+'}{fmtBRL(entry.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[entry.status]}`}>
                    {statusLabels[entry.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(entry)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {(entry.status === 'open' || entry.status === 'overdue') && (
                      <button
                        onClick={() => onMarkPaid(entry)}
                        className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Marcar como pago"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {entry.status !== 'cancelled' && (
                      <button
                        onClick={() => onCancel(entry)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Cancelar"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
          <span className="text-emerald-600 font-medium">Entradas:</span>
          <span className="font-bold text-emerald-700">{fmtBRL(totalReceivable)}</span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
          <span className="text-red-600 font-medium">Saídas:</span>
          <span className="font-bold text-red-700">{fmtBRL(totalPayable)}</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
          <span className="text-blue-600 font-medium">Saldo:</span>
          <span className={`font-bold ${totalReceivable - totalPayable >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {fmtBRL(totalReceivable - totalPayable)}
          </span>
        </div>
      </div>
    </div>
  )
}
