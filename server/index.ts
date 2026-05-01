import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { parseOcrText } from '../api/ocr'
import type { OcrParsed } from '../src/types/ocr'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '20mb' }))

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    let fileBase64: string
    let mimeType: string

    if (req.file) {
      fileBase64 = req.file.buffer.toString('base64')
      mimeType = req.file.mimetype
    } else if (req.body?.fileBase64) {
      fileBase64 = req.body.fileBase64
      mimeType = req.body.mimeType ?? 'image/jpeg'
    } else {
      return res.status(400).json({ error: 'Arquivo não encontrado' })
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      // Sem chave: retorna mock realista para testes
      const mock = {
        rawText: 'Amazon Serviços de Varejo\nCNPJ: 15.436.940/0001-03\nData: 15/04/2025\nTotal: R$ 1.250,00',
        parsed: parseOcrText('Amazon Serviços de Varejo\nCNPJ: 15.436.940/0001-03\nData: 15/04/2025\nTotal: R$ 1.250,00'),
        isMock: true,
      }
      return res.json(mock)
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
    res.json({ rawText, parsed: parseOcrText(rawText) })
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

const PORT = 3001
app.listen(PORT, () => console.log(`API dev server rodando em http://localhost:${PORT}`))
