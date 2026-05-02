import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface OcrExtracted {
  payee?: string
  amount_cents?: number
  date?: string
  type?: 'receita' | 'despesa'
  raw_text?: string
}

export async function extractReceiptWithClaude(base64: string, mimeType: string): Promise<OcrExtracted> {
  // Remove any non-ASCII characters from API key that could cause ByteString errors
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').replace(/[^\x20-\x7E]/g, '').trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurado')

  const isPdf = mimeType === 'application/pdf'
  const prompt = 'Extraia do comprovante: nome do fornecedor/favorecido (payee), valor total em centavos inteiros (amount_cents), data no formato YYYY-MM-DD (date), tipo: "receita" se entrada de dinheiro ou "despesa" se saida. Responda APENAS JSON sem markdown: {"payee":"","amount_cents":0,"date":"YYYY-MM-DD","type":"despesa"}'

  const content = isPdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: prompt },
      ]
    : [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt },
      ]

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Anthropic API ${resp.status}: ${err?.error?.message ?? resp.statusText}`)
  }

  const data = await resp.json() as { content: Array<{ type: string; text?: string }> }
  const text = data.content.find(b => b.type === 'text')?.text ?? '{}'
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()) as OcrExtracted }
  catch { return { raw_text: text } }
}
