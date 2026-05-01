import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const company_id = req.query.company_id as string
    if (!company_id) return res.status(400).json({ error: 'company_id obrigatorio' })
    const { data } = await supabase
      .from('drive_import_configs')
      .select('folder_id, folder_url')
      .eq('company_id', company_id)
      .maybeSingle()
    return res.json(data ?? {})
  }

  if (req.method === 'POST') {
    const { company_id, folder_id, folder_url } = req.body as { company_id: string; folder_id: string; folder_url: string }
    if (!company_id || !folder_id) return res.status(400).json({ error: 'company_id e folder_id obrigatorios' })
    const { error } = await supabase.from('drive_import_configs').upsert(
      { company_id, folder_id, folder_url, enabled: true },
      { onConflict: 'company_id' }
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
