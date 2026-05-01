import { supabase } from '../supabase'
import type { RecurringTransaction } from '../../types'
import { decimalToCents } from '../currency'

function toError(e: unknown): Error {
  if (e instanceof Error) return e
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as { message: unknown }).message))
  return new Error(String(e))
}

export interface RecurringFilters {
  companyIds: string[]
  isSimulation: boolean
  status?: 'active' | 'cancelled'
}

export async function getRecurring(filters: RecurringFilters): Promise<RecurringTransaction[]> {
  let q = supabase
    .from('recurring_transactions')
    .select('*')
    .in('company_id', filters.companyIds)
    .eq('is_simulation', filters.isSimulation)
    .order('start_date', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) throw toError(error)
  return data ?? []
}

export interface RecurringPayload {
  company_id: string
  account_id: string
  type: 'receita' | 'despesa'
  amount: string | number
  description: string
  start_date: string
  end_date?: string
  interval: 'semanal' | 'quinzenal' | 'mensal' | 'anual'
  channel?: string
  is_simulation: boolean
  status?: 'active' | 'cancelled'
}

export async function createRecurring(payload: RecurringPayload): Promise<RecurringTransaction> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({ 
      ...payload, 
      amount_cents: decimalToCents(payload.amount), 
      amount: undefined,
      status: payload.status ?? 'active'
    })
    .select()
    .single()
  if (error) throw toError(error)
  return data
}

export async function updateRecurring(id: string, payload: Partial<RecurringPayload>): Promise<void> {
  const update: Record<string, unknown> = { ...payload }
  if (payload.amount !== undefined) {
    update.amount_cents = decimalToCents(payload.amount)
    delete update.amount
  }
  const { error } = await supabase.from('recurring_transactions').update(update).eq('id', id)
  if (error) throw toError(error)
}

export async function cancelRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw toError(error)
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw toError(error)
}
