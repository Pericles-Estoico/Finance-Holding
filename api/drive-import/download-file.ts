import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const file_id = req.query.file_id as string
  if (!file_id) return res.status(400).json({ error: 'file_id obrigatório' })

  const apiKey = process.env.VITE_GOOGLE_DRIVE_API_KEY ?? process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'VITE_GOOGLE_DRIVE_API_KEY não configurado' })

  // Get file metadata (mimeType, name) via API key — works for link-shared files
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file_id}?fields=mimeType%2Cname&key=${apiKey}`
  )
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({})) as { error?: { message?: string } }
    return res.status(metaRes.status).json({ error: `Drive API (meta): ${err?.error?.message ?? metaRes.status}` })
  }
  const meta = await metaRes.json() as { mimeType: string; name: string }

  // Download via direct Drive URL — works for files shared "Anyone with the link"
  // API key download (?alt=media) requires OAuth2 for link-shared files
  const directUrl = `https://drive.google.com/uc?export=download&id=${file_id}`
  const contentRes = await fetch(directUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  })

  if (!contentRes.ok) {
    // Fallback: try API key download (works if file is truly public)
    const apiRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media&key=${apiKey}`
    )
    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({})) as { error?: { message?: string } }
      return res.status(apiRes.status).json({ error: `Drive API (download): ${err?.error?.message ?? apiRes.status}` })
    }
    const buffer = Buffer.from(await apiRes.arrayBuffer())
    return res.json({ base64: buffer.toString('base64'), mimeType: meta.mimeType, name: meta.name })
  }

  const buffer = Buffer.from(await contentRes.arrayBuffer())
  return res.json({ base64: buffer.toString('base64'), mimeType: meta.mimeType, name: meta.name })
}
