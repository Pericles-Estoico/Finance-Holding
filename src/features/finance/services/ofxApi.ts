import { supabase } from '../../../lib/supabase'
import type { OfxTransaction } from '../../../lib/ofxParser'
import type { FinancialEntry } from '../types/finance.types'

export interface OfxPendingEntry {
  id: string
  company_id: string
  fit_id: string
  ofx_type: 'DEBIT' | 'CREDIT' | 'OTHER'
  amount: number
  transaction_date: string
  name: string
  memo: string
  chart_account_id: string | null
  chart_account_v2_id: string | null
  entry_type: 'receivable' | 'payable' | null
  status: 'pending' | 'imported' | 'ignored'
  imported_entry_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Preenchido client-side após matching de regras
  autoClassified?: boolean
}

export interface OfxClassificationRule {
  id: string
  company_id: string
  payee_pattern: string
  chart_account_id: string | null
  chart_account_v2_id: string | null
  entry_type: 'receivable' | 'payable'
  match_count: number
  last_matched_at: string | null
  created_at: string
}

// ── Regras de auto-classificação ─────────────────────────────────────────────

export async function getClassificationRules(companyId: string): Promise<OfxClassificationRule[]> {
  const { data, error } = await supabase
    .from('ofx_classification_rules')
    .select('*')
    .eq('company_id', companyId)
    .order('match_count', { ascending: false })

  if (error) throw error
  return (data ?? []) as OfxClassificationRule[]
}

async function saveClassificationRule(
  companyId: string,
  payeePattern: string,
  chartAccountId: string | null,
  chartAccountV2Id: string | null,
  entryType: 'receivable' | 'payable'
): Promise<void> {
  await supabase
    .from('ofx_classification_rules')
    .upsert(
      {
        company_id: companyId,
        payee_pattern: payeePattern.toUpperCase().trim(),
        chart_account_id: chartAccountId,
        chart_account_v2_id: chartAccountV2Id,
        entry_type: entryType,
        last_matched_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,payee_pattern' }
    )
}

async function incrementRuleMatchCount(companyId: string, payeePattern: string): Promise<void> {
  try {
    await supabase.rpc('increment_ofx_rule_match_count', {
      p_company_id: companyId,
      p_pattern: payeePattern.toUpperCase().trim(),
    })
  } catch {
    // RPC opcional — ignora se não existir
  }
}

// Aplica regras de auto-classificação nas transações importadas
export function applyClassificationRules(
  transactions: OfxTransaction[],
  rules: OfxClassificationRule[]
): Array<OfxTransaction & { autoChartAccountId?: string; autoChartAccountV2Id?: string; autoEntryType?: 'receivable' | 'payable' }> {
  return transactions.map(t => {
    const key = t.name.toUpperCase().trim()
    const rule = rules.find(r => r.payee_pattern === key)
    if (!rule) return t
    return {
      ...t,
      autoChartAccountId:   rule.chart_account_id ?? undefined,
      autoChartAccountV2Id: rule.chart_account_v2_id ?? undefined,
      autoEntryType:        rule.entry_type,
    }
  })
}

// ── Importação de extrato OFX ─────────────────────────────────────────────────

export async function savePendingOfxEntries(
  companyId: string,
  transactions: OfxTransaction[]
): Promise<{ inserted: number; duplicates: number }> {
  const rows = transactions.map(t => ({
    company_id:       companyId,
    fit_id:           t.fitId,
    ofx_type:         t.type,
    amount:           t.amount,
    transaction_date: t.date,
    name:             t.name,
    memo:             t.memo,
    status:           'pending',
    entry_type:       t.type === 'CREDIT' ? 'receivable' : 'payable',
  }))

  const { data, error } = await supabase
    .from('ofx_pending_entries')
    .upsert(rows, { onConflict: 'company_id,fit_id', ignoreDuplicates: true })
    .select('id')

  if (error) throw error

  return {
    inserted:   data?.length ?? 0,
    duplicates: transactions.length - (data?.length ?? 0),
  }
}

export async function getPendingOfxEntries(companyId: string): Promise<OfxPendingEntry[]> {
  const { data, error } = await supabase
    .from('ofx_pending_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as OfxPendingEntry[]
}

// ── Classificação de lançamento pendente ──────────────────────────────────────

export async function classifyOfxEntry(
  pendingId: string,
  classification: {
    chartAccountId: string
    chartAccountV2Id?: string
    entryType: 'receivable' | 'payable'
    companyId: string
    description?: string
    saveRule?: boolean
  }
): Promise<FinancialEntry> {
  const { data: pending, error: fetchErr } = await supabase
    .from('ofx_pending_entries')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (fetchErr || !pending) throw fetchErr ?? new Error('Lançamento OFX não encontrado')

  const p = pending as OfxPendingEntry

  // Idempotency guard: already imported → return existing financial_entry
  if (p.status === 'imported' && p.imported_entry_id) {
    const { data: existing } = await supabase
      .from('financial_entries').select('*').eq('id', p.imported_entry_id).single()
    if (existing) return existing as FinancialEntry
  }

  const entryPayload: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'> = {
    type:                  classification.entryType,
    description:           classification.description || p.name || p.memo,
    amount:                p.amount,
    competence_date:       p.transaction_date,
    due_date:              p.transaction_date,
    paid_or_received_date: p.transaction_date,
    status:                classification.entryType === 'receivable' ? 'received' : 'paid',
    chart_account_id:      classification.chartAccountId,
    chart_account_v2_id:   classification.chartAccountV2Id ?? null,
    cost_center_id:        null,
    channel:               null,
    company_id:            classification.companyId,
    counterparty:          p.name || null,
    document_number:       p.fit_id,
    payment_method:        null,
    installment_number:    null,
    total_installments:    null,
    parent_entry_id:       null,
    is_recurring:          false,
    recurrence_frequency:  null,
    recurrence_end_date:   null,
    is_forecast:           false,
    bank_account_id:       null,
    notes:                 p.memo || null,
    created_by:            null,
  }

  const { data: entry, error: entryErr } = await supabase
    .from('financial_entries')
    .insert(entryPayload)
    .select()
    .single()

  if (entryErr) throw entryErr

  // Marca como importado
  await supabase
    .from('ofx_pending_entries')
    .update({
      status:             'imported',
      imported_entry_id:  entry.id,
      chart_account_id:   classification.chartAccountId,
      chart_account_v2_id: classification.chartAccountV2Id ?? null,
      entry_type:         classification.entryType,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', pendingId)

  // Salva regra de auto-classificação se solicitado
  if (classification.saveRule && p.name) {
    await saveClassificationRule(
      classification.companyId,
      p.name,
      classification.chartAccountId,
      classification.chartAccountV2Id ?? null,
      classification.entryType
    )
    await incrementRuleMatchCount(classification.companyId, p.name)
  }

  return entry as FinancialEntry
}

export async function ignoreOfxEntry(pendingId: string): Promise<void> {
  const { error } = await supabase
    .from('ofx_pending_entries')
    .update({ status: 'ignored', updated_at: new Date().toISOString() })
    .eq('id', pendingId)

  if (error) throw error
}
