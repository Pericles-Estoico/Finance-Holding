export type { OcrParsed } from '../../types/ocr'
import type { OcrParsed } from '../../types/ocr'

export async function runOcr(fileBase64: string, mimeType: string): Promise<{ rawText: string; parsed: OcrParsed; isMock?: boolean }> {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mimeType }),
  })
  const text = await res.text()
  let json: { rawText?: string; parsed?: OcrParsed; isMock?: boolean; error?: string }
  try { json = JSON.parse(text) } catch { throw new Error(`Resposta inválida do servidor OCR (${res.status})`) }
  if (!res.ok) throw new Error(json.error ?? `Erro no OCR (${res.status})`)
  return json as { rawText: string; parsed: OcrParsed; isMock?: boolean }
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve({
      base64: (reader.result as string).split(',')[1],
      mimeType: file.type,
    })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
