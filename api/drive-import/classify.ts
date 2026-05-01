import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { pending_id, company_id, account_id, type, save_rule } = req.body as {
      pending_id: string; company_id: string; account_id: string
      type: 'receita' | 'despesa'; save_rule: boolean
    }
    if (!pending_id || !company_id || !account_id || !type) return res.status(400).json({ error: 'Campos obrigatorios ausentes' })

    const { data: pending } = await supabase
      .from('pending_classifications').select('*')
      .eq('id', pending_id).eq('company_id', company_id).single()
    if (!pending) return res.status(404).json({ error: 'Pendente nao encontrado' })

    const extracted = pending.extracted_data as { payee?: string; amount_cents?: number; date?: string }

    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      company_id, account_id, type,
      amount_cents: extracted.amount_cents ?? 0,
      description: extracted.payee ?? pending.file_name ?? 'Comprovante Drive',
      date: extracted.date ?? new Date().toISOString().slice(0, 10),
      drive_file_url: pending.file_url, drive_file_id: pending.drive_file_id, is_simulation: false,
    }).select('id').single()
    if (txErr) throw new Error(txErr.message)

    await supabase.from('pending_classifications').update({ status: 'done', transaction_id: tx.id }).eq('id', pending_id)
    await supabase.from('drive_processed_files').update({ status: 'done', transaction_id: tx.id })
      .eq('drive_file_id', pending.drive_file_id).eq('company_id', company_id)

    if (save_rule && extracted.payee) {
      await supabase.from('payee_account_rules').upsert({
        company_id, payee_name: extracted.payee.toLowerCase().trim(),
        account_id, transaction_type: type, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,payee_name' })
    }

    return res.json({ transaction_id: tx.id })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
}
