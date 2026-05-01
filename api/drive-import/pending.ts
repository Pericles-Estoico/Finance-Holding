import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const company_id = req.query.company_id as string
  if (!company_id) return res.status(400).json({ error: 'company_id obrigatorio' })
  const { data, error } = await supabase
    .from('pending_classifications').select('*')
    .eq('company_id', company_id).eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ pending: data ?? [] })
}
