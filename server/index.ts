import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import Decimal from 'decimal.js'
import { parseOcrText } from '../api/ocr'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'https://financedre.com.br', 'https://www.financedre.com.br']

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(express.json({ limit: '20mb' }))

// ── OCR ─────────────────────────────────────────────────────────────────────

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

// ── WhatsApp ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const WA_TOKEN     = process.env.WHATSAPP_TOKEN!
const WA_PHONE_ID  = process.env.WHATSAPP_PHONE_ID!
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? 'finance_master_verify'
const ALLOWED      = (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '').split(',').map(s => s.trim()).filter(Boolean)

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(v: number) {
  return new Decimal(v).toDecimalPlaces(1).toNumber().toLocaleString('pt-BR') + '%'
}

function periodToDates(periodo: string): { from: string; to: string } {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual' || periodo === 'mês')
    return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` }
  if (periodo === 'trimestre')
    return { from: `${y}-${String(Math.floor(m/3)*3+1).padStart(2,'0')}-01`, to: `${y}-${String(Math.min(Math.floor(m/3)*3+3,12)).padStart(2,'0')}-30` }
  if (periodo === 'ano')
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  if (periodo === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return { from: d.toISOString().slice(0,10), to: now.toISOString().slice(0,10) }
  }
  if (/^\d{4}-\d{2}$/.test(periodo))
    return { from: `${periodo}-01`, to: `${periodo}-31` }
  return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` }
}

async function getUserCompanies() {
  const { data } = await supabase.from('companies').select('*').order('created_at')
  return data ?? []
}

async function toolConsultarDRE(params: { periodo: string; empresa?: string }) {
  const { from, to } = periodToDates(params.periodo)
  const companies = await getUserCompanies()
  if (!companies.length) return '❌ Nenhuma empresa cadastrada.'
  const targetCompanies = params.empresa
    ? companies.filter((c: { name: string }) => c.name.toLowerCase().includes(params.empresa!.toLowerCase()))
    : companies
  const ids = targetCompanies.map((c: { id: string }) => c.id)
  if (!ids.length) return `❌ Empresa "${params.empresa}" não encontrada.`
  const [{ data: txs }, { data: accs }] = await Promise.all([
    supabase.from('transactions').select('*').in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false),
    supabase.from('chart_of_accounts').select('*').in('company_id', ids),
  ])
  if (!txs?.length) return `📊 Nenhuma transação encontrada para o período.`
  const accMap = new Map((accs ?? []).map((a: { id: string }) => [a.id, a]))
  let receita = 0, deducoes = 0, cmv = 0, despOp = 0, impostos = 0
  for (const tx of txs) {
    const acc = accMap.get(tx.account_id) as { type: string; code: string } | undefined
    if (!acc) continue
    if (acc.type === 'receita') {
      if (acc.code.startsWith('1.0')) deducoes += tx.amount_cents
      else receita += tx.amount_cents
    } else if (acc.type === 'cmv') cmv += tx.amount_cents
    else if (acc.type === 'despesa_operacional') despOp += tx.amount_cents
    else if (acc.type === 'imposto') impostos += tx.amount_cents
  }
  const recLiq = receita - deducoes
  const lucroBruto = recLiq - cmv
  const lucroOp = lucroBruto - despOp
  const lucroLiq = lucroOp - impostos
  const mb = recLiq > 0 ? (lucroBruto / recLiq) * 100 : 0
  const ml = recLiq > 0 ? (lucroLiq / recLiq) * 100 : 0
  const empresa = targetCompanies.length === 1 ? targetCompanies[0].name : 'Consolidado'
  return [
    `📊 *DRE — ${empresa}*`, `📅 ${from} a ${to}`, ``,
    `💰 Receita Bruta:      ${fmtBRL(receita)}`,
    deducoes > 0 ? `➖ Deduções:            ${fmtBRL(deducoes)}` : null,
    `📥 Receita Líquida:    ${fmtBRL(recLiq)}`,
    cmv > 0 ? `🏭 CMV:                ${fmtBRL(cmv)}` : null, ``,
    `${lucroBruto >= 0 ? '✅' : '❌'} Lucro Bruto:        ${fmtBRL(lucroBruto)} _(${fmtPct(mb)})_`,
    despOp > 0 ? `📋 Desp. Operacionais: ${fmtBRL(despOp)}` : null,
    impostos > 0 ? `🧾 Impostos:           ${fmtBRL(impostos)}` : null, ``,
    `${lucroLiq >= 0 ? '💚' : '🔴'} *Lucro Líquido:     ${fmtBRL(lucroLiq)}*`,
    `📈 Margem Bruta:       ${fmtPct(mb)} ${mb >= 55 ? '✅' : mb >= 44 ? '⚠️' : '🔴'}`,
    `📉 Margem Líquida:     ${fmtPct(ml)} ${ml >= 18 ? '✅' : ml >= 14 ? '⚠️' : '🔴'}`,
  ].filter(Boolean).join('\n')
}

async function toolListarTransacoes(params: { periodo: string; tipo?: string; limite?: number; empresa?: string }) {
  const { from, to } = periodToDates(params.periodo)
  const companies = await getUserCompanies()
  const ids = companies.map((c: { id: string }) => c.id)
  if (!ids.length) return '❌ Nenhuma empresa cadastrada.'
  let q = supabase.from('transactions').select('*, chart_of_accounts(name, code, type)')
    .in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false)
    .order('date', { ascending: false }).limit(Math.min(params.limite ?? 10, 20))
  if (params.tipo === 'receita' || params.tipo === 'despesa') q = q.eq('type', params.tipo)
  const { data: txs } = await q
  if (!txs?.length) return '📭 Nenhuma transação encontrada.'
  const lines = (txs as Array<{
    date: string; type: string; description: string; amount_cents: number
    chart_of_accounts?: { name: string; code: string } | null
  }>).map(tx => {
    const icon = tx.type === 'receita' ? '🟢' : '🔴'
    const acc  = tx.chart_of_accounts
    return `${icon} ${tx.date.slice(5)} ${fmtBRL(tx.amount_cents)} — ${tx.description}${acc ? ` _(${acc.code})_` : ''}`
  })
  const total = txs.reduce((s: number, t: { amount_cents: number }) => s + t.amount_cents, 0)
  return [`📋 *Transações — ${from} a ${to}*`, ...lines, ``, `Total: *${fmtBRL(total)}*`].join('\n')
}

async function toolResumoKPIs(params: { periodo: string }) {
  const { from, to } = periodToDates(params.periodo)
  const companies = await getUserCompanies()
  const ids = companies.map((c: { id: string }) => c.id)
  const [{ data: txs }, { data: accs }, { count: totalTx }] = await Promise.all([
    supabase.from('transactions').select('*').in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false),
    supabase.from('chart_of_accounts').select('*').in('company_id', ids),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false),
  ])
  const accMap = new Map((accs ?? []).map((a: { id: string }) => [a.id, a]))
  let receita = 0, custos = 0, nReceita = 0
  for (const tx of (txs ?? [])) {
    const acc = accMap.get(tx.account_id) as { type: string; code: string } | undefined
    if (!acc) continue
    if (acc.type === 'receita' && !acc.code.startsWith('1.0')) { receita += tx.amount_cents; nReceita++ }
    else if (['cmv','despesa_operacional','imposto'].includes(acc.type)) custos += tx.amount_cents
  }
  const lucro = receita - custos
  const aov = nReceita > 0 ? Math.round(receita / nReceita) : 0
  const ml = receita > 0 ? (lucro / receita) * 100 : 0
  return [
    `🎯 *KPIs — ${params.periodo === 'mes_atual' || params.periodo === 'mês' ? 'Este Mês' : params.periodo}*`, ``,
    `💵 Receita:       ${fmtBRL(receita)}`,
    `💸 Custos totais: ${fmtBRL(custos)}`,
    `${lucro >= 0 ? '💚' : '🔴'} Lucro:          ${fmtBRL(lucro)}`,
    `📊 Margem:        ${fmtPct(ml)}`,
    `🛒 Ticket Médio:  ${aov > 0 ? fmtBRL(aov) : '—'}`,
    `📝 Lançamentos:   ${totalTx ?? 0}`,
    `🏢 Empresas:      ${companies.length}`,
  ].join('\n')
}

async function toolCriarTransacao(params: { empresa: string; tipo: 'receita' | 'despesa'; valor: number; descricao: string; data?: string }) {
  const companies = await getUserCompanies()
  const company = companies.find((c: { name: string }) => c.name.toLowerCase().includes(params.empresa.toLowerCase())) as { id: string; name: string } | undefined
  if (!company) return `❌ Empresa "${params.empresa}" não encontrada. Disponíveis: ${companies.map((c: { name: string }) => c.name).join(', ')}`
  const { data: accs } = await supabase.from('chart_of_accounts').select('*')
    .eq('company_id', company.id).eq('type', params.tipo === 'receita' ? 'receita' : 'despesa_operacional').order('code').limit(1)
  if (!accs?.length) return `❌ Nenhuma conta do tipo "${params.tipo}" encontrada para ${company.name}.`
  const amount_cents = Math.round(params.valor * 100)
  const date = params.data ?? new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('transactions').insert({
    company_id: company.id, account_id: accs[0].id, type: params.tipo,
    amount_cents, description: params.descricao, date, is_simulation: false,
  })
  if (error) return `❌ Erro: ${error.message}`
  return `${params.tipo === 'receita' ? '🟢' : '🔴'} Transação criada!\n📅 ${date}\n💰 ${fmtBRL(amount_cents)}\n📝 ${params.descricao}\n🏢 ${company.name}`
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_dre',
    description: 'Consulta DRE de um período: receita, custos, lucros e margens.',
    input_schema: { type: 'object' as const, properties: {
      periodo: { type: 'string', description: '"mes_atual", "trimestre", "ano", "semana" ou "YYYY-MM"' },
      empresa: { type: 'string', description: 'Nome parcial da empresa (opcional)' },
    }, required: ['periodo'] },
  },
  {
    name: 'listar_transacoes',
    description: 'Lista transações com filtros de tipo, período e empresa.',
    input_schema: { type: 'object' as const, properties: {
      periodo:  { type: 'string' },
      tipo:     { type: 'string', enum: ['receita', 'despesa'] },
      limite:   { type: 'number' },
      empresa:  { type: 'string' },
    }, required: ['periodo'] },
  },
  {
    name: 'resumo_kpis',
    description: 'KPIs resumidos: receita, lucro, margem, ticket médio, total de lançamentos.',
    input_schema: { type: 'object' as const, properties: {
      periodo: { type: 'string' },
    }, required: ['periodo'] },
  },
  {
    name: 'criar_transacao',
    description: 'Cria um novo lançamento financeiro.',
    input_schema: { type: 'object' as const, properties: {
      empresa:   { type: 'string' },
      tipo:      { type: 'string', enum: ['receita', 'despesa'] },
      valor:     { type: 'number' },
      descricao: { type: 'string' },
      data:      { type: 'string' },
    }, required: ['empresa', 'tipo', 'valor', 'descricao'] },
  },
]

const SYSTEM_PROMPT = `Você é o assistente financeiro do Finance Master, sistema de gestão multi-CNPJ.
Responda em português, de forma concisa para WhatsApp. Use emojis com moderação.
Para valores monetários use R$ X.XXX,XX. Nunca invente dados — use sempre as ferramentas.`

async function processWithClaude(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: SYSTEM_PROMPT, tools: TOOLS, messages,
    })
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        let result = ''
        try {
          const p = block.input as Record<string, unknown>
          if (block.name === 'consultar_dre')    result = await toolConsultarDRE(p as Parameters<typeof toolConsultarDRE>[0])
          if (block.name === 'listar_transacoes') result = await toolListarTransacoes(p as Parameters<typeof toolListarTransacoes>[0])
          if (block.name === 'resumo_kpis')      result = await toolResumoKPIs(p as Parameters<typeof toolResumoKPIs>[0])
          if (block.name === 'criar_transacao')  result = await toolCriarTransacao(p as Parameters<typeof toolCriarTransacao>[0])
        } catch (e) { result = `Erro: ${e instanceof Error ? e.message : String(e)}` }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }
    const text = response.content.find(b => b.type === 'text')
    return text?.type === 'text' ? text.text : '❓ Não consegui processar.'
  }
  return '⚠️ Muitas iterações. Tente uma pergunta mais simples.'
}

async function sendWhatsApp(to: string, text: string) {
  await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual',
      to, type: 'text', text: { body: text, preview_url: false },
    }),
  })
}

// GET — verificação do webhook pela Meta
app.get('/api/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verificado ✓')
    return res.status(200).send(challenge)
  }
  return res.status(403).json({ error: 'Forbidden' })
})

// POST — mensagens recebidas
app.post('/api/whatsapp', (req, res) => {
  // Responde 200 imediatamente (Meta exige < 5s)
  res.status(200).end()

  void (async () => {
    try {
      const body = req.body as {
        object?: string
        entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ type: string; from: string; text?: { body: string } }> } }> }>
      }
      if (body.object !== 'whatsapp_business_account') return
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      if (!message || message.type !== 'text' || !message.text?.body) return

      const from = message.from
      const text = message.text.body.trim()

      if (ALLOWED.length > 0 && !ALLOWED.includes(from)) {
        await sendWhatsApp(from, '🔒 Acesso não autorizado.')
        return
      }

      console.log(`[WhatsApp] ${from}: ${text}`)

      const lower = text.toLowerCase()
      if (lower === 'ajuda' || lower === 'help' || lower === '/ajuda') {
        await sendWhatsApp(from, [
          '🤖 *Finance Master — Assistente*', '',
          'Exemplos:', '• "qual o DRE do mês?"',
          '• "KPIs do trimestre"', '• "últimas 5 despesas"',
          '• "receita de janeiro"', '• "criar despesa: aluguel 3500 empresa ABC"',
        ].join('\n'))
        return
      }

      const reply = await processWithClaude(text)
      await sendWhatsApp(from, reply)
    } catch (e) {
      console.error('[WhatsApp] Erro:', e)
    }
  })()
})

// ── Drive Import ──────────────────────────────────────────────────────────────

interface OcrExtracted {
  payee?: string
  amount_cents?: number
  date?: string
  type?: 'receita' | 'despesa'
  raw_text?: string
}

async function extractReceiptWithClaude(base64: string, mimeType: string): Promise<OcrExtracted> {
  const isPdf = mimeType === 'application/pdf'
  const content: Anthropic.MessageParam['content'] = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: 'Extraia do comprovante: nome do fornecedor/favorecido (payee), valor total em centavos inteiros (amount_cents), data no formato YYYY-MM-DD (date), tipo: "receita" se é entrada de dinheiro ou "despesa" se é saída. Responda APENAS JSON sem markdown: {"payee":"","amount_cents":0,"date":"YYYY-MM-DD","type":"despesa"}' },
      ]
    : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } },
        { type: 'text' as const, text: 'Extraia do comprovante: nome do fornecedor/favorecido (payee), valor total em centavos inteiros (amount_cents), data no formato YYYY-MM-DD (date), tipo: "receita" se é entrada de dinheiro ou "despesa" se é saída. Responda APENAS JSON sem markdown: {"payee":"","amount_cents":0,"date":"YYYY-MM-DD","type":"despesa"}' },
      ]

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content }],
  })
  const text = resp.content.find(b => b.type === 'text')?.type === 'text'
    ? (resp.content.find(b => b.type === 'text') as { type: 'text'; text: string }).text
    : '{}'
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned) as OcrExtracted
  } catch {
    return { raw_text: text }
  }
}

// Check which Drive file IDs are already processed for this company
app.post('/api/drive-import/check-processed', async (req, res) => {
  try {
    const { company_id, file_ids } = req.body as { company_id: string; file_ids: string[] }
    if (!company_id || !Array.isArray(file_ids)) return res.status(400).json({ error: 'company_id e file_ids obrigatorios' })
    const { data } = await supabase
      .from('drive_processed_files')
      .select('drive_file_id')
      .eq('company_id', company_id)
      .in('drive_file_id', file_ids)
    const processed_ids = (data ?? []).map((r: { drive_file_id: string }) => r.drive_file_id)
    return res.json({ processed_ids })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

// OCR + classify + create transaction or add to pending queue
app.post('/api/drive-import/process-file', async (req, res) => {
  try {
    const { company_id, file_id, file_name, file_url, base64, mime_type } = req.body as {
      company_id: string; file_id: string; file_name: string
      file_url: string; base64: string; mime_type: string
    }
    if (!company_id || !file_id || !base64) return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

    // Check already processed
    const { data: existing } = await supabase
      .from('drive_processed_files')
      .select('id, status, transaction_id')
      .eq('drive_file_id', file_id)
      .eq('company_id', company_id)
      .maybeSingle()
    if (existing) return res.json({ status: 'already_processed', transaction_id: existing.transaction_id })

    // OCR via Claude Vision
    const extracted = await extractReceiptWithClaude(base64, mime_type)

    const payeeKey = (extracted.payee ?? '').toLowerCase().trim()

    // Look up payee rule
    const { data: rule } = await supabase
      .from('payee_account_rules')
      .select('account_id, transaction_type')
      .eq('company_id', company_id)
      .eq('payee_name', payeeKey)
      .maybeSingle()

    if (rule && extracted.amount_cents && extracted.date) {
      // Auto-create transaction
      const { data: tx, error: txErr } = await supabase.from('transactions').insert({
        company_id,
        account_id: rule.account_id,
        type: rule.transaction_type,
        amount_cents: extracted.amount_cents,
        description: extracted.payee ?? file_name,
        date: extracted.date,
        drive_file_url: file_url,
        drive_file_id: file_id,
        is_simulation: false,
      }).select('id').single()
      if (txErr) throw new Error(txErr.message)

      await supabase.from('drive_processed_files').insert({
        drive_file_id: file_id, company_id, file_name, file_url,
        transaction_id: tx.id, status: 'done', ocr_data: extracted,
      })

      return res.json({ status: 'auto_created', transaction_id: tx.id, extracted })
    }

    // No rule — add to pending queue
    const { data: pending, error: pErr } = await supabase.from('pending_classifications').insert({
      company_id, drive_file_id: file_id, file_name, file_url, extracted_data: extracted,
    }).select('id').single()
    if (pErr) throw new Error(pErr.message)

    await supabase.from('drive_processed_files').insert({
      drive_file_id: file_id, company_id, file_name, file_url,
      status: 'pending', ocr_data: extracted,
    })

    return res.json({ status: 'pending', pending_id: pending.id, extracted })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

// List pending classifications
app.get('/api/drive-import/pending', async (req, res) => {
  try {
    const company_id = req.query.company_id as string
    if (!company_id) return res.status(400).json({ error: 'company_id obrigatório' })
    const { data, error } = await supabase
      .from('pending_classifications')
      .select('*')
      .eq('company_id', company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return res.json({ pending: data ?? [] })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

// Assign account → create transaction + save payee rule
app.post('/api/drive-import/classify', async (req, res) => {
  try {
    const { pending_id, company_id, account_id, type, save_rule } = req.body as {
      pending_id: string; company_id: string; account_id: string
      type: 'receita' | 'despesa'; save_rule: boolean
    }
    if (!pending_id || !company_id || !account_id || !type) return res.status(400).json({ error: 'Campos obrigatórios ausentes' })

    const { data: pending, error: pErr } = await supabase
      .from('pending_classifications')
      .select('*')
      .eq('id', pending_id)
      .eq('company_id', company_id)
      .single()
    if (pErr || !pending) return res.status(404).json({ error: 'Pendente não encontrado' })

    const extracted = pending.extracted_data as OcrExtracted

    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      company_id,
      account_id,
      type,
      amount_cents: extracted.amount_cents ?? 0,
      description: extracted.payee ?? pending.file_name ?? 'Comprovante Drive',
      date: extracted.date ?? new Date().toISOString().slice(0, 10),
      drive_file_url: pending.file_url,
      drive_file_id: pending.drive_file_id,
      is_simulation: false,
    }).select('id').single()
    if (txErr) throw new Error(txErr.message)

    // Mark pending as done
    await supabase.from('pending_classifications').update({
      status: 'done', transaction_id: tx.id,
    }).eq('id', pending_id)

    // Update processed file record
    await supabase.from('drive_processed_files').update({
      status: 'done', transaction_id: tx.id,
    }).eq('drive_file_id', pending.drive_file_id).eq('company_id', company_id)

    // Save payee rule if requested
    if (save_rule && extracted.payee) {
      const payeeKey = extracted.payee.toLowerCase().trim()
      await supabase.from('payee_account_rules').upsert({
        company_id, payee_name: payeeKey, account_id, transaction_type: type, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,payee_name' })
    }

    return res.json({ transaction_id: tx.id })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

// Get/Save Drive folder config
app.get('/api/drive-import/config', async (req, res) => {
  try {
    const company_id = req.query.company_id as string
    if (!company_id) return res.status(400).json({ error: 'company_id obrigatório' })
    const { data } = await supabase
      .from('drive_import_configs')
      .select('folder_id, folder_url')
      .eq('company_id', company_id)
      .maybeSingle()
    return res.json(data ?? {})
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

app.post('/api/drive-import/config', async (req, res) => {
  try {
    const { company_id, folder_id, folder_url } = req.body as { company_id: string; folder_id: string; folder_url: string }
    if (!company_id || !folder_id) return res.status(400).json({ error: 'company_id e folder_id obrigatórios' })
    const { error } = await supabase.from('drive_import_configs').upsert(
      { company_id, folder_id, folder_url, enabled: true },
      { onConflict: 'company_id' }
    )
    if (error) throw new Error(error.message)
    return res.json({ ok: true })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro interno' })
  }
})

// ── Inicialização ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
