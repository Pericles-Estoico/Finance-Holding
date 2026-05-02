import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const folder_id = req.query.folder_id as string
  if (!folder_id) return res.status(400).json({ error: 'folder_id obrigatório' })

  const apiKey = process.env.VITE_GOOGLE_DRIVE_API_KEY ?? process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'VITE_GOOGLE_DRIVE_API_KEY não configurado' })

  const params = new URLSearchParams({
    q: `'${folder_id}' in parents and trashed = false and (mimeType contains 'image/' or mimeType = 'application/pdf')`,
    fields: 'files(id,name,mimeType,webViewLink,createdTime)',
    pageSize: '100',
    orderBy: 'createdTime desc',
    key: apiKey,
  })

  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`)
  if (!driveRes.ok) {
    const err = await driveRes.json().catch(() => ({})) as { error?: { message?: string } }
    return res.status(driveRes.status).json({ error: `Drive API: ${err?.error?.message ?? driveRes.status}` })
  }

  const data = await driveRes.json() as { files: unknown[] }
  return res.json({ files: data.files ?? [] })
}
