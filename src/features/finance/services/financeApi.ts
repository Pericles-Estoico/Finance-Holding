import { supabase } from '../../../lib/supabase'
import type {
  ChartAccount,
  FinancialEntry,
  BankAccount,
  CostCenter,
  DateRange,
} from '../types/finance.types'

export async function getChartAccounts(companyId: string): Promise<ChartAccount[]> {
  const { data, error } = await supabase
    .from('chart_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('code')
  if (error) throw error
  return data as ChartAccount[]
}

export async function createChartAccount(
  payload: Omit<ChartAccount, 'id' | 'created_at' | 'updated_at'>
): Promise<ChartAccount> {
  const { data, error } = await supabase
    .from('chart_accounts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as ChartAccount
}

export async function updateChartAccount(
  id: string,
  payload: Partial<Omit<ChartAccount, 'id' | 'created_at' | 'updated_at'>>
): Promise<ChartAccount> {
  const { data, error } = await supabase
    .from('chart_accounts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ChartAccount
}

export async function deleteChartAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('chart_accounts')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function seedDefaultChartAccounts(companyId: string): Promise<void> {
  const { error } = await supabase.rpc('seed_default_chart_accounts', {
    p_company_id: companyId,
  })
  if (error) throw error
}

export interface FinancialEntriesFilters {
  dateRange?: DateRange
  status?: string
  type?: string
}

export async function getFinancialEntries(
  companyId: string,
  filters?: FinancialEntriesFilters
): Promise<FinancialEntry[]> {
  let query = supabase
    .from('financial_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('competence_date', { ascending: false })

  if (filters?.dateRange) {
    query = query
      .gte('competence_date', filters.dateRange.from)
      .lte('competence_date', filters.dateRange.to)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  const { data, error } = await query
  if (error) throw error
  return data as FinancialEntry[]
}

export async function createFinancialEntry(
  payload: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<FinancialEntry> {
  const { data, error } = await supabase
    .from('financial_entries')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as FinancialEntry
}

export async function updateFinancialEntry(
  id: string,
  payload: Partial<Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>>
): Promise<FinancialEntry> {
  const { data, error } = await supabase
    .from('financial_entries')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as FinancialEntry
}

export async function deleteFinancialEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function createInstallments(
  basePayload: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at' | 'installment_number' | 'total_installments' | 'due_date' | 'parent_entry_id'>,
  installments: number,
  firstDueDate: string
): Promise<FinancialEntry[]> {
  const firstEntry = await createFinancialEntry({
    ...basePayload,
    due_date: firstDueDate,
    installment_number: 1,
    total_installments: installments,
    parent_entry_id: null,
  })

  const remaining: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>[] = []
  const baseDate = new Date(firstDueDate)

  for (let i = 2; i <= installments; i++) {
    const dueDate = new Date(baseDate)
    dueDate.setMonth(dueDate.getMonth() + (i - 1))
    remaining.push({
      ...basePayload,
      due_date: dueDate.toISOString().split('T')[0],
      installment_number: i,
      total_installments: installments,
      parent_entry_id: firstEntry.id,
    })
  }

  if (remaining.length === 0) return [firstEntry]

  const { data, error } = await supabase
    .from('financial_entries')
    .insert(remaining)
    .select()
  if (error) throw error

  return [firstEntry, ...(data as FinancialEntry[])]
}

export async function getBankAccounts(companyId: string): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as BankAccount[]
}

export async function createBankAccount(
  payload: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>
): Promise<BankAccount> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as BankAccount
}

export async function getCostCenters(companyId: string): Promise<CostCenter[]> {
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as CostCenter[]
}

// Busca lançamentos de TODAS as empresas do usuário (RLS garante isolamento por user_id)
export async function getConsolidatedEntries(): Promise<FinancialEntry[]> {
  const { data, error } = await supabase
    .from('financial_entries')
    .select('*')
    .order('competence_date', { ascending: false })
  if (error) throw error
  return data as FinancialEntry[]
}
