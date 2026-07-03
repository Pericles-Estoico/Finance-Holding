import { supabase } from '../../../lib/supabase'

export type AccountClass = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
export type NormalBalance = 'debit' | 'credit'

export interface ChartAccountV2 {
  id: string
  account_code: string
  account_name: string
  description: string | null
  account_class: AccountClass
  account_type: string
  normal_balance: NormalBalance
  parent_account_id: string | null
  level: number
  is_calculated: boolean
  is_active: boolean
  company_id: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ChartAccountV2Insert = Omit<ChartAccountV2, 'id' | 'created_at' | 'updated_at'>


export async function getCorporateChart(companyId: string): Promise<ChartAccountV2[]> {
  const { data, error } = await supabase
    .from('chart_accounts_v2')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('account_code')
  if (error) throw error
  return data as ChartAccountV2[]
}

export async function getCorporateChartByClass(
  companyId: string,
  accountClass: AccountClass
): Promise<ChartAccountV2[]> {
  const { data, error } = await supabase
    .from('chart_accounts_v2')
    .select('*')
    .eq('company_id', companyId)
    .eq('account_class', accountClass)
    .eq('is_active', true)
    .order('account_code')
  if (error) throw error
  return data as ChartAccountV2[]
}

export async function createCorporateAccount(
  payload: ChartAccountV2Insert
): Promise<ChartAccountV2> {
  const { data, error } = await supabase
    .from('chart_accounts_v2')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as ChartAccountV2
}

export async function updateCorporateAccount(
  id: string,
  payload: Partial<Pick<ChartAccountV2, 'account_name' | 'description' | 'account_type' | 'parent_account_id' | 'is_active'>>
): Promise<ChartAccountV2> {
  const { data, error } = await supabase
    .from('chart_accounts_v2')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ChartAccountV2
}

export async function softDeleteCorporateAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('chart_accounts_v2')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function hasCorporateChartAccounts(companyId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('chart_accounts_v2')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function seedCorporateChart(companyId: string): Promise<{ seeded: boolean; message: string }> {
  const alreadySeeded = await hasCorporateChartAccounts(companyId)
  if (alreadySeeded) {
    return { seeded: false, message: 'Plano de contas corporativo já existe para esta empresa.' }
  }

  const { error } = await supabase.rpc('seed_corporate_chart', { p_company_id: companyId })
  if (error) throw error

  return { seeded: true, message: 'Plano de Contas Corporativo IPO/M&A importado com sucesso.' }
}

export function buildAccountTree(accounts: ChartAccountV2[]): ChartAccountV2[] {
  const map = new Map<string, ChartAccountV2 & { children?: ChartAccountV2[] }>()
  const roots: (ChartAccountV2 & { children?: ChartAccountV2[] })[] = []

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] })
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!
    if (acc.parent_account_id && map.has(acc.parent_account_id)) {
      map.get(acc.parent_account_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
