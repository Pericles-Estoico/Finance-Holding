export type { OcrParsed } from '../../types/ocr'
import type { OcrParsed } from '../../types/ocr'

export async function runOcr(fileBase64: string, mimeType: string): Promise<{ rawText: string; parsed: OcrParsed; isMock?: boolean }> {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mimeType }),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Erro no OCR')
  }
  return res.json()
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
