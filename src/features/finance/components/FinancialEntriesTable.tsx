import { useMemo, useState } from 'react'
import { Edit2, CheckCircle, XCircle, Download, Copy } from 'lucide-react'
import { fmtBRL } from '../../../lib/currency'
import type { FinancialEntry, ChartAccount, EntryType, EntryStatus } from '../types/finance.types'

const CHANNELS = ['Shopee', 'Mercado Livre', 'Shein', 'Loja Própria', 'Atacado', 'Outros']

interface Props {
  entries: FinancialEntry[]
  chartAccounts: ChartAccount[]
  onEdit: (entry: FinancialEntry) => void
  onMarkPaid: (entry: FinancialEntry) => void
  onCancel: (entry: FinancialEntry) => void
  onDuplicate?: (entry: FinancialEntry) => void
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

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

function exportCSV(rows: FinancialEntry[], accounts: ChartAccount[]) {
  const getAccName = (id: string) => accounts.find((a) => a.id === id)?.name ?? ''
  const header = ['Tipo', 'Descrição', 'Competência', 'Vencimento', 'Pagamento', 'Conta', 'Canal', 'Valor', 'Status', 'Contraparte', 'Documento']
  const body = rows.map((e) => [
    e.type === 'receivable' ? 'A Receber' : 'A Pagar',
    e.description,
    e.competence_date,
    e.due_date,
    e.paid_or_received_date ?? '',
    getAccName(e.chart_account_id),
    e.channel ?? '',
    e.amount.toFixed(2).replace('.', ','),
    statusLabels[e.status],
    e.counterparty ?? '',
    e.document_number ?? '',
  ])
  const csv = [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lancamentos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FinancialEntriesTable({
  entries,
  chartAccounts,
  onEdit,
  onMarkPaid,
  onCancel,
  onDuplicate,
  filterType = 'all',
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const availableChannels = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.channel) set.add(e.channel)
    }
    const custom = Array.from(set).filter((c) => !CHANNELS.includes(c))
    return [...CHANNELS, ...custom]
  }, [entries])

  function getAccountName(id: string) {
    return chartAccounts.find((a) => a.id === id)?.name ?? '-'
  }

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (channelFilter !== 'all' && e.channel !== channelFilter) return false
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
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos canais</option>
          {availableChannels.map((c) => (
            <option key={c} value={c}>{c}</option>
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
        <button
          onClick={() => exportCSV(filtered, chartAccounts)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Exportar CSV"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Competência</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Conta</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Canal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
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
                <td className="px-4 py-3 text-gray-500 text-xs">{entry.channel ?? '—'}</td>
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
                    {onDuplicate && (
                      <button
                        onClick={() => onDuplicate(entry)}
                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                        title="Duplicar"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
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
        <div className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
