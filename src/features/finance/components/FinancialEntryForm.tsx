import { useState } from 'react'
import { X } from 'lucide-react'
import type { ChartAccount, FinancialEntry, EntryType, EntryStatus, BankAccount, CostCenter } from '../types/finance.types'
import AccountCombobox from './AccountCombobox'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>, installments?: number) => void
  chartAccounts: ChartAccount[]
  bankAccounts: BankAccount[]
  costCenters: CostCenter[]
  companyId: string
  initial?: Partial<FinancialEntry>
}

const statusOptions: { value: EntryStatus; label: string }[] = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'open', label: 'Em aberto' },
  { value: 'paid', label: 'Pago' },
  { value: 'received', label: 'Recebido' },
  { value: 'overdue', label: 'Vencido' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'partially_paid', label: 'Parcialmente pago' },
]

export default function FinancialEntryForm({
  open,
  onClose,
  onSave,
  chartAccounts,
  bankAccounts,
  costCenters,
  companyId,
  initial,
}: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [type, setType] = useState<EntryType>(initial?.type ?? 'payable')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [competenceDate, setCompetenceDate] = useState(initial?.competence_date ?? today)
  const [dueDate, setDueDate] = useState(initial?.due_date ?? today)
  const [paidDate, setPaidDate] = useState(initial?.paid_or_received_date ?? '')
  const [status, setStatus] = useState<EntryStatus>(initial?.status ?? 'open')
  const [chartAccountId, setChartAccountId] = useState(initial?.chart_account_id ?? '')
  const [bankAccountId, setBankAccountId] = useState(initial?.bank_account_id ?? '')
  const [costCenterId, setCostCenterId] = useState(initial?.cost_center_id ?? '')
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [installments, setInstallments] = useState(1)
  const [isForecast, setIsForecast] = useState(initial?.is_forecast ?? false)

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'> = {
      type,
      description,
      amount: parseFloat(amount) || 0,
      competence_date: competenceDate,
      due_date: dueDate,
      paid_or_received_date: paidDate || null,
      status,
      chart_account_id: chartAccountId,
      chart_account_v2_id: initial?.chart_account_v2_id ?? null,
      cost_center_id: costCenterId || null,
      channel: null,
      company_id: companyId,
      counterparty: counterparty || null,
      document_number: null,
      payment_method: null,
      installment_number: installments > 1 ? 1 : null,
      total_installments: installments > 1 ? installments : null,
      parent_entry_id: null,
      is_recurring: false,
      recurrence_frequency: null,
      recurrence_end_date: null,
      is_forecast: isForecast,
      bank_account_id: bankAccountId || null,
      notes: notes || null,
      created_by: null,
    }
    onSave(payload, installments > 1 ? installments : undefined)
  }

  const activeAccounts = chartAccounts.filter((a) => a.is_active && a.level > 1)

  const selectedAccount = activeAccounts.find((a) => a.id === chartAccountId)
  const isProLabore = selectedAccount
    ? /pr[oó].?labore/i.test(selectedAccount.name) || /pr[oó].?labore/i.test(selectedAccount.code)
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            {initial?.id ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EntryType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="receivable">A Receber</option>
                <option value="payable">A Pagar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EntryStatus)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Compra de Tecido Lote 001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Parcelas</label>
              <input
                type="number"
                min="1"
                max="60"
                value={installments}
                onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Competência</label>
              <input
                type="date"
                required
                value={competenceDate}
                onChange={(e) => setCompetenceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {(status === 'paid' || status === 'received') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Pagamento/Recebimento</label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Conta Contábil</label>
            <AccountCombobox
              accounts={activeAccounts}
              value={chartAccountId}
              onChange={setChartAccountId}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {bankAccounts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Conta Bancária</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhuma</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            {costCenters.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Centro de Custo</label>
                <select
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nenhum</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {isProLabore ? 'Beneficiário (familiar)' : 'Contraparte / Fornecedor'}
            </label>
            {isProLabore ? (
              <select
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione o beneficiário...</option>
                <option value="Família">Família</option>
                <option value="Pericles">Pericles</option>
                <option value="Felipe">Felipe</option>
                <option value="Stella">Stella</option>
                <option value="Kalev">Kalev</option>
                <option value="Doações">Doações</option>
              </select>
            ) : (
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Fornecedor de tecido"
              />
            )}
          </div>

          {/* Toggle Previsão */}
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${isForecast ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200'}`}>
            <div>
              <p className="text-sm font-medium text-gray-800">Lançamento de Previsão</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isForecast ? 'Visível no gráfico de projeção como valor previsto' : 'Lançamento realizado ou a vencer normalmente'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsForecast((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isForecast ? 'bg-violet-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isForecast ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {installments > 1 ? `Salvar ${installments} Parcelas` : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
