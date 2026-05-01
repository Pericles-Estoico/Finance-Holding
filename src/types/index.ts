export type TaxRegime = 'simples_nacional' | 'lucro_presumido'

export type SaleChannel =
  | 'amazon'
  | 'shopify'
  | 'varejo_fisico'
  | 'b2b'
  | 'mercado_livre'
  | 'outros'

export type TransactionType = 'receita' | 'despesa'

export interface Company {
  id: string
  user_id: string
  name: string
  cnpj: string
  tax_regime: TaxRegime
  logo_url?: string
  created_at: string
}

export interface AccountCategory {
  id: string
  company_id: string
  code: string
  name: string
  type: 'ativo' | 'passivo' | 'receita' | 'cmv' | 'despesa_operacional' | 'imposto'
  parent_id?: string
  is_system: boolean
  created_at: string
}

export interface Transaction {
  id: string
  company_id: string
  account_id: string
  type: TransactionType
  amount_cents: number
  description: string
  date: string
  channel?: SaleChannel
  drive_file_url?: string
  drive_file_id?: string
  is_simulation: boolean
  created_at: string
}



export type RecurrenceInterval = 'semanal' | 'quinzenal' | 'mensal' | 'anual'


export interface RecurringTransaction {
  id: string
  company_id: string
  account_id: string
  type: TransactionType
  amount_cents: number
  description: string
  start_date: string
  end_date?: string
  interval: RecurrenceInterval
  channel?: SaleChannel
  is_simulation: boolean
  status: 'active' | 'cancelled'
  created_at: string
}

export interface Benchmark {
  id: string
  metric_key: string
  metric_name: string
  min_value: number
  max_value: number
  sector: string
  year: number
  source: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
}
