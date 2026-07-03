import { supabase } from '../supabase'
import type { Transaction } from '../../types'
import { decimalToCents } from '../currency'

function toError(e: unknown): Error {
  if (e instanceof Error) return e
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as { message: unknown }).message))
  return new Error(String(e))
}

export interface TransactionFilters {
  companyIds: string[]
  isSimulation: boolean
  dateFrom?: string
  dateTo?: string
  channel?: string
}

export async function getTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  let q = supabase
    .from('transactions')
    .select('*')
    .in('company_id', filters.companyIds)
    .eq('is_simulation', filters.isSimulation)
    .order('date', { ascending: false })

  if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
  if (filters.dateTo)   q = q.lte('date', filters.dateTo)
  if (filters.channel)  q = q.eq('channel', filters.channel)

  const { data, error } = await q
  if (error) throw toError(error)
  return data ?? []
}

export interface TransactionPayload {
  company_id: string
  account_id?: string
  chart_account_v2_id?: string
  type: 'receita' | 'despesa'
  amount: string | number
  description: string
  date: string
  channel?: string
  is_simulation: boolean
}

export async function createTransaction(payload: TransactionPayload): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, amount_cents: decimalToCents(payload.amount), amount: undefined })
    .select()
    .single()
  if (error) throw toError(error)
  return data
}

export async function updateTransaction(id: string, payload: Partial<TransactionPayload>): Promise<void> {
  const update: Record<string, unknown> = { ...payload }
  if (payload.amount !== undefined) {
    update.amount_cents = decimalToCents(payload.amount)
    delete update.amount
  }
  const { error } = await supabase.from('transactions').update(update).eq('id', id)
  if (error) throw toError(error)
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw toError(error)
}
