import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import type { OcrParsed } from './src/types/ocr'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Carrega .env manualmente — Vite só injeta VITE_* no cliente
function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* .env opcional */ }
}

loadEnvFile()

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseOcrText(text: string): OcrParsed {
  const dateMatch =
    text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/) ||
    text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  let date: string | null = null
  if (dateMatch) {
    date = dateMatch[0].includes('/')
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : dateMatch[0]
  }

  const valueMatch = text.match(
    /(?:total|valor total|vl\.?\s*total|r\$)\s*[:\s]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/i
  )
  let totalCents: number | null = null
  if (valueMatch) {
    const raw = valueMatch[1].replace(/\./g, '').replace(',', '.')
    totalCents = Math.round(parseFloat(raw) * 100)
  }

  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  const supplierCnpj = cnpjMatch ? cnpjMatch[0] : null

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const supplierName = lines.find(l => l.length > 3 && !/^\d/.test(l) && !/cnpj/i.test(l)) ?? null

  const lower = text.toLowerCase()
  let suggestedAccountCode: string | null = null
  if (/amazon|mercado livre|shopify|vtex/.test(lower))                       suggestedAccountCode = '2.5'
  else if (/correios|sedex|jadlog|loggi|transportadora/.test(lower))         suggestedAccountCode = '3.4.1'
  else if (/google ads|meta ads|facebook ads|publicidade|marketing/.test(lower)) suggestedAccountCode = '3.1.1'
  else if (/aluguel|condom[ií]nio|iptu/.test(lower))                         suggestedAccountCode = '3.2.2'
  else if (/contador|contab/.test(lower))                                    suggestedAccountCode = '3.2.3'
  else if (/banco|bradesco|ita[uú]|santander|tarifa/.test(lower))            suggestedAccountCode = '3.3.2'
  else if (/mat[eé]ria prima|insumo|tecido|pl[aá]stico/.test(lower))        suggestedAccountCode = '2.1'
  else if (/embalagem|caixa|envelope/.test(lower))                           suggestedAccountCode = '2.3'

  return { date, totalCents, supplierName, supplierCnpj, suggestedAccountCode }
}

const MOCK_TEXT = 'EXEMPLO — configure GOOGLE_VISION_API_KEY para OCR real\nFornecedor: Preencha manualmente\nData: ' + new Date().toLocaleDateString('pt-BR') + '\nTotal: R$ 0,00'

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function apiPlugin(): Plugin {
  return {
    name: 'vite-api-plugin',
    configureServer(server) {
      // Usa middleware genérico com checagem de URL para evitar problemas de path stripping
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url !== '/api/ocr' || req.method !== 'POST') {
          next()
          return
        }

        console.log('[API] POST /api/ocr recebido')

        try {
          const bodyBuf = await readBody(req)
          const bodyStr = bodyBuf.toString('utf-8')

          if (!bodyStr) {
            sendJson(res, 400, { error: 'Body vazio' })
            return
          }

          let parsed: { fileBase64?: string; mimeType?: string }
          try {
            parsed = JSON.parse(bodyStr) as { fileBase64?: string; mimeType?: string }
          } catch {
            sendJson(res, 400, { error: 'JSON inválido no body' })
            return
          }

          const { fileBase64, mimeType } = parsed

          if (!fileBase64 || !mimeType) {
            sendJson(res, 400, { error: 'fileBase64 e mimeType são obrigatórios' })
            return
          }

          const apiKey = process.env.GOOGLE_VISION_API_KEY

          if (!apiKey) {
            console.log('[API] Sem GOOGLE_VISION_API_KEY — retornando mock')
            sendJson(res, 200, { rawText: MOCK_TEXT, parsed: parseOcrText(MOCK_TEXT), isMock: true })
            return
          }

          const visionRes = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requests: [{ image: { content: fileBase64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 1 }] }],
              }),
            }
          )

          const data = await visionRes.json() as {
            responses: Array<{ fullTextAnnotation?: { text: string }; error?: { message: string } }>
          }
          const rawText = data.responses[0]?.fullTextAnnotation?.text ?? ''
          sendJson(res, 200, { rawText, parsed: parseOcrText(rawText) })

        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro interno'
          console.error('[API] Erro no OCR:', msg)
          sendJson(res, 500, { error: msg })
        }
      })
    },
  }
}
