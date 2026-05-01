import { supabase } from '../supabase'
import type { AccountCategory } from '../../types'

function toError(e: unknown): Error {
  if (e instanceof Error) return e
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as { message: unknown }).message))
  return new Error(String(e))
}

export async function getAccounts(companyId: string): Promise<AccountCategory[]> {
  if (!companyId) return []
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('code')
  if (error) throw toError(error)
  return data ?? []
}

export async function createAccount(payload: Omit<AccountCategory, 'id' | 'created_at'>): Promise<AccountCategory> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert(payload)
    .select()
    .single()
  if (error) throw toError(error)
  return data
}

export async function updateAccount(id: string, payload: Partial<Pick<AccountCategory, 'name' | 'code' | 'type'>>): Promise<void> {
  const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', id)
  if (error) throw toError(error)
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id)
  if (error) throw toError(error)
}
