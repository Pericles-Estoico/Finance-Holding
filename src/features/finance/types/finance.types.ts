export type EntryType = 'receivable' | 'payable'

export type EntryStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'received'
  | 'overdue'
  | 'cancelled'
  | 'partially_paid'

export type AccountType =
  | 'gross_revenue'
  | 'revenue_deduction'
  | 'cogs'
  | 'commercial_expense'
  | 'administrative_expense'
  | 'operational_expense'
  | 'depreciation'
  | 'amortization'
  | 'financial_expense'
  | 'financial_income'
  | 'tax_on_profit'
  | 'investment'
  | 'equity'

export type DreGroup =
  | 'gross_revenue'
  | 'revenue_deductions'
  | 'cogs'
  | 'commercial_expenses'
  | 'administrative_expenses'
  | 'operational_expenses'
  | 'depreciation_amortization'
  | 'financial_result'
  | 'taxes_on_profit'

export type EbitdaGroup =
  | 'net_revenue'
  | 'cogs'
  | 'commercial_expenses'
  | 'administrative_expenses'
  | 'operational_expenses'
  | 'excluded_from_ebitda'

export type CashFlowGroup =
  | 'operating_inflow'
  | 'operating_outflow'
  | 'financing_inflow'
  | 'financing_outflow'
  | 'investment_outflow'
  | 'tax_outflow'
  | 'owner_withdrawal'
  | 'capital_injection'

export interface ChartAccount {
  id: string
  code: string
  name: string
  parent_id: string | null
  level: number
  account_type: AccountType
  dre_group: DreGroup | null
  ebitda_group: EbitdaGroup | null
  cash_flow_group: CashFlowGroup | null
  affects_dre: boolean
  affects_ebitda: boolean
  affects_cash_flow: boolean
  is_active: boolean
  company_id: string
  created_at: string
  updated_at: string
}

export interface FinancialEntry {
  id: string
  type: EntryType
  description: string
  amount: number
  competence_date: string
  due_date: string
  paid_or_received_date: string | null
  status: EntryStatus
  chart_account_id: string
  cost_center_id: string | null
  channel: string | null
  company_id: string
  counterparty: string | null
  document_number: string | null
  payment_method: string | null
  installment_number: number | null
  total_installments: number | null
  parent_entry_id: string | null
  is_recurring: boolean
  recurrence_frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null
  recurrence_end_date: string | null
  bank_account_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_name: string | null
  initial_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CostCenter {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DateRange {
  from: string
  to: string
}

export interface DreResult {
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  cmv: number
  lucroBruto: number
  despesasComerciais: number
  despesasAdministrativas: number
  despesasOperacionais: number
  totalDespesasOperacionais: number
  ebitda: number
  depreciacao: number
  ebit: number
  resultadoFinanceiro: number
  impostos: number
  lucroLiquido: number
  margemBruta: number
  margemEbitda: number
  margemLiquida: number
  byGroup: Record<string, number>
  entriesByGroup: Record<string, FinancialEntry[]>
}

export interface EbitdaResult {
  netRevenue: number
  cogs: number
  grossProfit: number
  eligibleExpenses: number
  ebitda: number
  ebitdaMargin: number
  excludedItems: Array<{ group: string; amount: number; entries: FinancialEntry[] }>
  byGroup: Record<string, number>
}

export interface CashFlowDayRow {
  date: string
  openingBalance: number
  projectedInflow: number
  realizedInflow: number
  projectedOutflow: number
  realizedOutflow: number
  closingBalance: number
  status: 'healthy' | 'warning' | 'critical'
  entries: FinancialEntry[]
}

export interface CashFlowProjection {
  rows: CashFlowDayRow[]
  initialBalance: number
  projectedBalance7d: number
  projectedBalance15d: number
  projectedBalance30d: number
  projectedBalance60d: number
  projectedBalance90d: number
  lowestProjectedBalance: number
  negativeCashDays: number
  totalProjectedInflow: number
  totalProjectedOutflow: number
}

export type FinancialEntryFormData = Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at' | 'created_by'>
