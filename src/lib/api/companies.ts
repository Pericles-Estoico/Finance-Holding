import { supabase } from '../supabase'
import type { Company } from '../../types'

export async function getCompanies(userId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createCompany(payload: Omit<Company, 'id' | 'created_at'>): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  // Semeia plano de contas padrão
  await supabase.rpc('seed_default_chart_of_accounts', { p_company_id: data.id })

  return data
}

export async function updateCompany(id: string, payload: Partial<Pick<Company, 'name' | 'cnpj' | 'tax_regime'>>): Promise<void> {
  const { error } = await supabase.from('companies').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw error
}
