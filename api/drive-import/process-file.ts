import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, extractReceiptWithClaude } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { company_id, file_id, file_name, file_url, base64, mime_type } = req.body as {
      company_id: string; file_id: string; file_name: string
      file_url: string; base64: string; mime_type: string
    }
    if (!company_id || !file_id || !base64) return res.status(400).json({ error: 'Campos obrigatorios ausentes' })

    const { data: existing } = await supabase
      .from('drive_processed_files').select('id,status,transaction_id')
      .eq('drive_file_id', file_id).eq('company_id', company_id).maybeSingle()
    if (existing) return res.json({ status: 'already_processed', transaction_id: existing.transaction_id })

    const extracted = await extractReceiptWithClaude(base64, mime_type)
    const payeeKey = (extracted.payee ?? '').toLowerCase().trim()

    const { data: rule } = await supabase
      .from('payee_account_rules').select('account_id,transaction_type')
      .eq('company_id', company_id).eq('payee_name', payeeKey).maybeSingle()

    if (rule && extracted.amount_cents && extracted.date) {
      const { data: tx, error: txErr } = await supabase.from('transactions').insert({
        company_id, account_id: rule.account_id, type: rule.transaction_type,
        amount_cents: extracted.amount_cents, description: extracted.payee ?? file_name,
        date: extracted.date, drive_file_url: file_url, drive_file_id: file_id, is_simulation: false,
      }).select('id').single()
      if (txErr) throw new Error(txErr.message)
      await supabase.from('drive_processed_files').insert({
        drive_file_id: file_id, company_id, file_name, file_url,
        transaction_id: tx.id, status: 'done', ocr_data: extracted,
      })
      return res.json({ status: 'auto_created', transaction_id: tx.id, extracted })
    }

    const { data: pending, error: pErr } = await supabase.from('pending_classifications').insert({
      company_id, drive_file_id: file_id, file_name, file_url, extracted_data: extracted,
    }).select('id').single()
    if (pErr) throw new Error(pErr.message)
    await supabase.from('drive_processed_files').insert({
      drive_file_id: file_id, company_id, file_name, file_url, status: 'pending', ocr_data: extracted,
    })
    return res.json({ status: 'pending', pending_id: pending.id, extracted })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[process-file] ERROR:', msg, stack)
    return res.status(500).json({ error: msg })
  }
}
