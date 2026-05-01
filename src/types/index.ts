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

export interface DriveImportConfig {
  id: string
  company_id: string
  folder_id: string
  folder_url?: string
  enabled: boolean
  last_scanned_at?: string
  created_at: string
}

export interface DriveProcessedFile {
  id: string
  drive_file_id: string
  company_id: string
  file_name?: string
  file_url?: string
  transaction_id?: string
  status: 'done' | 'pending' | 'error'
  ocr_data?: Record<string, unknown>
  created_at: string
}

export interface PayeeAccountRule {
  id: string
  company_id: string
  payee_name: string
  account_id: string
  transaction_type: TransactionType
  created_at: string
  updated_at: string
}

export interface PendingClassification {
  id: string
  company_id: string
  drive_file_id: string
  file_name?: string
  file_url?: string
  extracted_data: {
    payee?: string
    amount_cents?: number
    date?: string
    type?: TransactionType
    raw_text?: string
  }
  status: 'pending' | 'done' | 'skipped'
  transaction_id?: string
  created_at: string
}
