import type { Plugin } from 'vite'
import { parseOcrText } from './api/ocr'
import type { IncomingMessage, ServerResponse } from 'http'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export function apiPlugin(): Plugin {
  return {
    name: 'vite-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/ocr', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const body = await readBody(req)
          const { fileBase64, mimeType } = JSON.parse(body) as { fileBase64?: string; mimeType?: string }

          if (!fileBase64 || !mimeType) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'fileBase64 e mimeType são obrigatórios' }))
            return
          }

          const apiKey = process.env.GOOGLE_VISION_API_KEY

          if (!apiKey) {
            // Mock realista para desenvolvimento sem chave Vision
            const mockText = 'Amazon Serviços de Varejo do Brasil Ltda\nCNPJ: 15.436.940/0001-03\nData: 15/04/2025\nTotal: R$ 1.250,00'
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ rawText: mockText, parsed: parseOcrText(mockText), isMock: true }))
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
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ rawText, parsed: parseOcrText(rawText) }))
        } catch (e: unknown) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }))
        }
      })
    },
  }
}
