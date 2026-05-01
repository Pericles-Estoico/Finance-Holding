import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface OcrExtracted {
  payee?: string
  amount_cents?: number
  date?: string
  type?: 'receita' | 'despesa'
  raw_text?: string
}

export async function extractReceiptWithClaude(base64: string, mimeType: string): Promise<OcrExtracted> {
  const isPdf = mimeType === 'application/pdf'
  const content: Anthropic.MessageParam['content'] = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: 'Extraia do comprovante: nome do fornecedor/favorecido (payee), valor total em centavos inteiros (amount_cents), data no formato YYYY-MM-DD (date), tipo: "receita" se entrada de dinheiro ou "despesa" se saida. Responda APENAS JSON sem markdown: {"payee":"","amount_cents":0,"date":"YYYY-MM-DD","type":"despesa"}' },
      ]
    : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } },
        { type: 'text' as const, text: 'Extraia do comprovante: nome do fornecedor/favorecido (payee), valor total em centavos inteiros (amount_cents), data no formato YYYY-MM-DD (date), tipo: "receita" se entrada de dinheiro ou "despesa" se saida. Responda APENAS JSON sem markdown: {"payee":"","amount_cents":0,"date":"YYYY-MM-DD","type":"despesa"}' },
      ]

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content }],
  })
  const text = resp.content.find(b => b.type === 'text')?.type === 'text'
    ? (resp.content.find(b => b.type === 'text') as { type: 'text'; text: string }).text
    : '{}'
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()) as OcrExtracted }
  catch { return { raw_text: text } }
}
