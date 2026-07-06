import { useEffect, useState } from 'react'
import { Plus, Receipt, BookOpen } from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import FinancialEntryForm from '../features/finance/components/FinancialEntryForm'
import FinancialEntriesTable from '../features/finance/components/FinancialEntriesTable'
import ChartAccountsManager from '../features/finance/components/ChartAccountsManager'
import FinancialDataHealthCheck from '../features/finance/components/FinancialDataHealthCheck'
import {
  getChartAccounts,
  getFinancialEntries,
  getBankAccounts,
  getCostCenters,
  createFinancialEntry,
  createInstallments,
  updateFinancialEntry,
  createChartAccount,
  updateChartAccount,
  seedDefaultChartAccounts,
} from '../features/finance/services/financeApi'
import { getCorporateChart, type ChartAccountV2 } from '../features/finance/services/corporateChartApi'
import {
  simulationChartAccounts,
  simulationFinancialEntries,
  simulationBankAccounts,
  simulationCostCenters,
  SIMULATION_COMPANY_ID,
} from '../features/finance/data/simulationData'
import type {
  ChartAccount,
  FinancialEntry,
  BankAccount,
  CostCenter,
} from '../features/finance/types/finance.types'

type TabId = 'entries' | 'accounts'

export default function FinancialEntriesPage() {
  const { activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()

  const companyId =
    activeCompanyId === 'consolidated' ? '' : (activeCompanyId as string)

  const [tab, setTab] = useState<TabId>('entries')
  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all')

  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [chartAccountsV2, setChartAccountsV2] = useState<ChartAccountV2[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null)

  async function loadAll() {
    setLoading(true)
    setError(null)

    if (isSimulation) {
      setEntries(simulationFinancialEntries)
      setChartAccounts(simulationChartAccounts)
      setBankAccounts(simulationBankAccounts)
      setCostCenters(simulationCostCenters)
      setLoading(false)
      return
    }

    if (!companyId) {
      setEntries([])
      setChartAccounts([])
      setBankAccounts([])
      setCostCenters([])
      setLoading(false)
      return
    }

    try {
      const [accountsData, entriesData, banksData, ccData, v2Data] = await Promise.all([
        getChartAccounts(companyId),
        getFinancialEntries(companyId),
        getBankAccounts(companyId),
        getCostCenters(companyId),
        getCorporateChart(companyId).catch(() => [] as ChartAccountV2[]),
      ])
      setChartAccounts(accountsData)
      setEntries(entriesData)
      setBankAccounts(banksData)
      setCostCenters(ccData)
      setChartAccountsV2(v2Data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isSimulation])

  function openNew() {
    setEditingEntry(null)
    setFormOpen(true)
  }

  function openEdit(entry: FinancialEntry) {
    setEditingEntry(entry)
    setFormOpen(true)
  }

  async function handleSave(
    payload: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>,
    installments?: number
  ) {
    if (isSimulation || !companyId) {
      const newEntry: FinancialEntry = {
        ...payload,
        id: editingEntry?.id ?? `local-${Date.now()}`,
        created_at: editingEntry?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setEntries((prev) => {
        if (editingEntry) {
          return prev.map((e) => (e.id === editingEntry.id ? newEntry : e))
        }
        return [newEntry, ...prev]
      })
      setFormOpen(false)
      setEditingEntry(null)
      return
    }

    try {
      if (editingEntry) {
        await updateFinancialEntry(editingEntry.id, payload)
      } else if (installments && installments > 1) {
        const baseWithoutInstallment: Omit<
          FinancialEntry,
          'id' | 'created_at' | 'updated_at' | 'installment_number' | 'total_installments' | 'due_date' | 'parent_entry_id'
        > = {
          type: payload.type,
          description: payload.description,
          amount: payload.amount,
          competence_date: payload.competence_date,
          paid_or_received_date: payload.paid_or_received_date,
          status: payload.status,
          chart_account_id: payload.chart_account_id,
          chart_account_v2_id: payload.chart_account_v2_id,
          cost_center_id: payload.cost_center_id,
          channel: payload.channel,
          company_id: payload.company_id,
          counterparty: payload.counterparty,
          document_number: payload.document_number,
          payment_method: payload.payment_method,
          is_recurring: payload.is_recurring,
          recurrence_frequency: payload.recurrence_frequency,
          recurrence_end_date: payload.recurrence_end_date,
          is_forecast: payload.is_forecast,
          bank_account_id: payload.bank_account_id,
          notes: payload.notes,
          created_by: payload.created_by,
        }
        await createInstallments(baseWithoutInstallment, installments, payload.due_date)
      } else {
        await createFinancialEntry(payload)
      }
      await loadAll()
      setFormOpen(false)
      setEditingEntry(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lancamento')
    }
  }

  async function handleMarkPaid(entry: FinancialEntry) {
    const today = new Date().toISOString().split('T')[0]
    const newStatus = entry.type === 'receivable' ? 'received' : 'paid'

    if (isSimulation || !companyId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: newStatus, paid_or_received_date: today, updated_at: new Date().toISOString() }
            : e
        )
      )
      return
    }

    try {
      await updateFinancialEntry(entry.id, {
        status: newStatus,
        paid_or_received_date: today,
      })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    }
  }

  function handleDuplicate(entry: FinancialEntry) {
    const { id: _id, created_at: _ca, updated_at: _ua, paid_or_received_date: _pd, ...rest } = entry
    void _id; void _ca; void _ua; void _pd
    setEditingEntry({
      ...rest,
      id: '',
      created_at: '',
      updated_at: '',
      paid_or_received_date: null,
      status: 'open',
    } as FinancialEntry)
    setFormOpen(true)
  }

  async function handleCancelEntry(entry: FinancialEntry) {
    if (isSimulation || !companyId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: 'cancelled', updated_at: new Date().toISOString() }
            : e
        )
      )
      return
    }

    try {
      await updateFinancialEntry(entry.id, { status: 'cancelled' })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar lancamento')
    }
  }

  async function handleSeedAccounts() {
    if (isSimulation || !companyId) {
      setChartAccounts(simulationChartAccounts)
      return
    }
    setSeeding(true)
    try {
      await seedDefaultChartAccounts(companyId)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao popular plano de contas')
    } finally {
      setSeeding(false)
    }
  }

  async function handleCreateAccount(payload: Omit<ChartAccount, 'id' | 'created_at' | 'updated_at'>) {
    if (isSimulation || !companyId) {
      const newAcc: ChartAccount = {
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setChartAccounts((prev) => [...prev, newAcc])
      return
    }
    try {
      await createChartAccount(payload)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    }
  }

  async function handleUpdateAccount(id: string, payload: Partial<ChartAccount>) {
    if (isSimulation || !companyId) {
      setChartAccounts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, ...payload, updated_at: new Date().toISOString() } : a
        )
      )
      return
    }
    try {
      await updateChartAccount(id, payload)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar conta')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lancamentos Financeiros</h1>
          <p className="text-sm text-gray-500">
            Contas a pagar, contas a receber e plano de contas
          </p>
        </div>
        {tab === 'entries' && (
          <button
            onClick={openNew}
            disabled={!companyId && !isSimulation}
            title={!companyId && !isSimulation ? 'Selecione uma empresa para criar lançamentos' : undefined}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Lancamento
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('entries')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'entries'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Lancamentos
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Plano de Contas
        </button>
      </div>

      {!loading && entries.length > 0 && (
        <FinancialDataHealthCheck entries={entries} chartAccounts={chartAccounts} chartAccountsV2={chartAccountsV2} />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && tab === 'entries' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['all', 'receivable', 'payable'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'receivable' ? 'A Receber' : 'A Pagar'}
              </button>
            ))}
          </div>
          <FinancialEntriesTable
            entries={entries}
            chartAccounts={chartAccounts}
            chartAccountsV2={chartAccountsV2}
            onEdit={openEdit}
            onMarkPaid={handleMarkPaid}
            onCancel={handleCancelEntry}
            onDuplicate={handleDuplicate}
            filterType={filterType}
          />
        </div>
      )}

      {!loading && tab === 'accounts' && (
        <ChartAccountsManager
          accounts={chartAccounts}
          onSeed={handleSeedAccounts}
          onCreate={handleCreateAccount}
          onUpdate={handleUpdateAccount}
          companyId={companyId}
          loading={seeding}
        />
      )}

      <FinancialEntryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingEntry(null)
        }}
        onSave={handleSave}
        chartAccounts={chartAccounts}
        bankAccounts={bankAccounts}
        costCenters={costCenters}
        companyId={companyId || SIMULATION_COMPANY_ID}
        initial={editingEntry ?? undefined}
      />
    </div>
  )
}
