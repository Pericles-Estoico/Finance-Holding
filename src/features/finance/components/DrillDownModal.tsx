import { X } from 'lucide-react'
import type { FinancialEntry, ChartAccount } from '../types/finance.types'
import { formatBRL } from '../../../lib/currency'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  entries: FinancialEntry[]
  chartAccounts: ChartAccount[]
}

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  open: 'Em aberto',
  paid: 'Pago',
  received: 'Recebido',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  partially_paid: 'Parcialmente pago',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  received: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  partially_paid: 'bg-amber-100 text-amber-700',
}

export default function DrillDownModal({ open, onClose, title, entries, chartAccounts }: Props) {
  if (!open) return null

  function getAccountName(id: string) {
    return chartAccounts.find((a) => a.id === id)?.name ?? '-'
  }

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{entries.length} lançamentos</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Competência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Conta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(entry.competence_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{entry.description}</td>
                  <td className="px-4 py-3 text-gray-600">{getAccountName(entry.chart_account_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[entry.status]}`}>
                      {statusLabels[entry.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatBRL(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-lg font-bold text-gray-900">{formatBRL(total)}</span>
        </div>
      </div>
    </div>
  )
}
