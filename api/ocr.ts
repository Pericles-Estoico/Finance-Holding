import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { OcrParsed } from '../src/types/ocr'
export type { OcrParsed }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fileBase64, mimeType } = req.body as { fileBase64?: string; mimeType?: string }
  if (!fileBase64 || !mimeType) return res.status(400).json({ error: 'fileBase64 e mimeType são obrigatórios' })

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_VISION_API_KEY não configurada' })

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: fileBase64 },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  )

  if (!visionRes.ok) {
    const err = await visionRes.json()
    return res.status(502).json({ error: 'Erro Vision API', detail: err })
  }

  const data = await visionRes.json() as {
    responses: Array<{ fullTextAnnotation?: { text: string }; error?: { message: string } }>
  }
  const response = data.responses[0]
  if (response?.error) return res.status(502).json({ error: response.error.message })

  const rawText = response?.fullTextAnnotation?.text ?? ''
  return res.status(200).json({ rawText, parsed: parseOcrText(rawText) })
}

export function parseOcrText(text: string): OcrParsed {
  // Data: DD/MM/YYYY ou YYYY-MM-DD
  const dateMatch =
    text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/) ||
    text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  let date: string | null = null
  if (dateMatch) {
    if (dateMatch[0].includes('/')) {
      date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    } else {
      date = dateMatch[0]
    }
  }

  // Valor total — busca "total", "valor", "r$" seguido de número
  const valueMatch = text.match(
    /(?:total|valor total|vl\.?\s*total|r\$)\s*[:\s]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/i
  )
  let totalCents: number | null = null
  if (valueMatch) {
    const raw = valueMatch[1].replace(/\./g, '').replace(',', '.')
    totalCents = Math.round(parseFloat(raw) * 100)
  }

  // CNPJ
  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  const supplierCnpj = cnpjMatch ? cnpjMatch[0] : null

  // Nome do fornecedor — primeira linha não numérica
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const supplierName = lines.find(l => l.length > 3 && !/^\d/.test(l) && !/cnpj/i.test(l)) ?? null

  // Classificação inteligente por palavras-chave
  const lower = text.toLowerCase()
  let suggestedAccountCode: string | null = null
  if (/amazon|mercado livre|shopify|vtex|loja integrada/.test(lower)) suggestedAccountCode = '2.5'
  else if (/correios|sedex|jadlog|total express|loggi|transportadora/.test(lower)) suggestedAccountCode = '3.4.1'
  else if (/google ads|meta ads|facebook ads|tiktok ads|publicidade|marketing/.test(lower)) suggestedAccountCode = '3.1.1'
  else if (/aluguel|condomínio|iptu/.test(lower)) suggestedAccountCode = '3.2.2'
  else if (/contador|contab|escritório contábil/.test(lower)) suggestedAccountCode = '3.2.3'
  else if (/banco|bb|bradesco|itaú|santander|tarifa|iof/.test(lower)) suggestedAccountCode = '3.3.2'
  else if (/matéria prima|insumo|material|tecido|plástico/.test(lower)) suggestedAccountCode = '2.1'
  else if (/embalagem|caixa|envelope|fita/.test(lower)) suggestedAccountCode = '2.3'

  return { date, totalCents, supplierName, supplierCnpj, suggestedAccountCode }
}
