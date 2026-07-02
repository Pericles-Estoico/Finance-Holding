import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { company_id, file_ids } = req.body as { company_id: string; file_ids: string[] }
  if (!company_id || !Array.isArray(file_ids))
    return res.status(400).json({ error: 'company_id e file_ids obrigatorios' })
  const { data } = await supabase
    .from('drive_processed_files')
    .select('drive_file_id')
    .eq('company_id', company_id)
    .eq('status', 'done')
    .in('drive_file_id', file_ids)
  return res.json({ processed_ids: (data ?? []).map((r: { drive_file_id: string }) => r.drive_file_id) })
}
