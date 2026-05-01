import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import Decimal from 'decimal.js'

// ─── Clientes ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypassa RLS — só para uso no servidor
)

const WA_TOKEN    = process.env.WHATSAPP_TOKEN!
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID!
const VERIFY_TOKEN= process.env.WHATSAPP_VERIFY_TOKEN ?? 'finance_master_verify'
// Números autorizados (ex: "5511999999999,5521888888888")
const ALLOWED     = (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '').split(',').map(s => s.trim()).filter(Boolean)

// ─── Helpers financeiros ──────────────────────────────────────────────────────

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(v: number): string {
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
  // Tenta interpretar como "YYYY-MM"
  if (/^\d{4}-\d{2}$/.test(periodo))
    return { from: `${periodo}-01`, to: `${periodo}-31` }
  return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` }
}

// ─── Implementações das tools ─────────────────────────────────────────────────

async function getUserCompanies(userId?: string) {
  const q = supabase.from('companies').select('*').order('created_at')
  if (userId) q.eq('user_id', userId)
  const { data } = await q
  return data ?? []
}

async function toolConsultarDRE(params: { periodo: string; empresa?: string }) {
  const { from, to } = periodToDates(params.periodo)

  // Pega empresas
  const companies = await getUserCompanies()
  if (!companies.length) return '❌ Nenhuma empresa cadastrada.'

  const targetCompanies = params.empresa
    ? companies.filter(c => c.name.toLowerCase().includes(params.empresa!.toLowerCase()))
    : companies

  const ids = targetCompanies.map((c: { id: string }) => c.id)
  if (!ids.length) return `❌ Empresa "${params.empresa}" não encontrada.`

  const [{ data: txs }, { data: accs }] = await Promise.all([
    supabase.from('transactions').select('*').in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false),
    supabase.from('chart_of_accounts').select('*').in('company_id', ids),
  ])

  if (!txs?.length) return `📊 Nenhuma transação encontrada para ${params.periodo === 'mes_atual' || params.periodo === 'mês' ? 'este mês' : params.periodo}.`

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
    `📊 *DRE — ${empresa}*`,
    `📅 ${from} a ${to}`,
    ``,
    `💰 Receita Bruta:        ${fmtBRL(receita)}`,
    deducoes > 0 ? `➖ Deduções:              ${fmtBRL(deducoes)}` : null,
    `📥 Receita Líquida:      ${fmtBRL(recLiq)}`,
    cmv > 0 ? `🏭 CMV:                  ${fmtBRL(cmv)}` : null,
    ``,
    `${lucroBruto >= 0 ? '✅' : '❌'} Lucro Bruto:          ${fmtBRL(lucroBruto)} _(${fmtPct(mb)})_`,
    despOp > 0 ? `📋 Desp. Operacionais:   ${fmtBRL(despOp)}` : null,
    impostos > 0 ? `🧾 Impostos:             ${fmtBRL(impostos)}` : null,
    ``,
    `${lucroLiq >= 0 ? '💚' : '🔴'} *Lucro Líquido:       ${fmtBRL(lucroLiq)}*`,
    `📈 Margem Bruta:         ${fmtPct(mb)} ${mb >= 55 ? '✅' : mb >= 44 ? '⚠️' : '🔴'}`,
    `📉 Margem Líquida:       ${fmtPct(ml)} ${ml >= 18 ? '✅' : ml >= 14 ? '⚠️' : '🔴'}`,
  ].filter(Boolean).join('\n')
}

async function toolListarTransacoes(params: { periodo: string; tipo?: string; limite?: number; empresa?: string }) {
  const { from, to } = periodToDates(params.periodo)
  const companies = await getUserCompanies()
  const ids = companies.map((c: { id: string }) => c.id)
  if (!ids.length) return '❌ Nenhuma empresa cadastrada.'

  let q = supabase.from('transactions').select('*, chart_of_accounts(name, code, type)')
    .in('company_id', ids).gte('date', from).lte('date', to).eq('is_simulation', false)
    .order('date', { ascending: false }).limit(params.limite ?? 10)

  if (params.tipo === 'receita' || params.tipo === 'despesa') q = q.eq('type', params.tipo)

  const { data: txs } = await q
  if (!txs?.length) return '📭 Nenhuma transação encontrada.'

  const lines = (txs as Array<{
    date: string; type: string; description: string; amount_cents: number; channel?: string
    chart_of_accounts?: { name: string; code: string } | null
  }>).map(tx => {
    const icon = tx.type === 'receita' ? '🟢' : '🔴'
    const val  = fmtBRL(tx.amount_cents)
    const acc  = tx.chart_of_accounts
    return `${icon} ${tx.date.slice(5)} ${val} — ${tx.description}${acc ? ` _(${acc.code})_` : ''}`
  })

  const total = txs.reduce((s: number, t: { amount_cents: number }) => s + t.amount_cents, 0)
  return [
    `📋 *Transações — ${from} a ${to}*`,
    ...lines,
    ``,
    `Total: *${fmtBRL(total)}*`,
  ].join('\n')
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
    `🎯 *KPIs — ${params.periodo === 'mes_atual' || params.periodo === 'mês' ? 'Este Mês' : params.periodo}*`,
    ``,
    `💵 Receita:       ${fmtBRL(receita)}`,
    `💸 Custos totais: ${fmtBRL(custos)}`,
    `${lucro >= 0 ? '💚' : '🔴'} Lucro:          ${fmtBRL(lucro)}`,
    `📊 Margem:        ${fmtPct(ml)}`,
    `🛒 Ticket Médio:  ${aov > 0 ? fmtBRL(aov) : '—'}`,
    `📝 Lançamentos:   ${totalTx ?? 0}`,
    `🏢 Empresas:      ${companies.length}`,
  ].join('\n')
}

async function toolCriarTransacao(params: {
  empresa: string; tipo: 'receita' | 'despesa'
  valor: number; descricao: string; data?: string
}) {
  const companies = await getUserCompanies()
  const company = companies.find((c: { name: string }) =>
    c.name.toLowerCase().includes(params.empresa.toLowerCase())
  ) as { id: string; name: string } | undefined

  if (!company) return `❌ Empresa "${params.empresa}" não encontrada. Empresas: ${companies.map((c: { name: string }) => c.name).join(', ')}`

  // Pega conta padrão pelo tipo
  const { data: accs } = await supabase.from('chart_of_accounts').select('*')
    .eq('company_id', company.id)
    .eq('type', params.tipo === 'receita' ? 'receita' : 'despesa_operacional')
    .order('code').limit(1)

  if (!accs?.length) return `❌ Nenhuma conta do tipo "${params.tipo}" encontrada para ${company.name}.`

  const amount_cents = Math.round(params.valor * 100)
  const date = params.data ?? new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('transactions').insert({
    company_id:    company.id,
    account_id:    accs[0].id,
    type:          params.tipo,
    amount_cents,
    description:   params.descricao,
    date,
    is_simulation: false,
  })

  if (error) return `❌ Erro ao criar transação: ${error.message}`

  const icon = params.tipo === 'receita' ? '🟢' : '🔴'
  return `${icon} Transação criada!\n📅 ${date}\n💰 ${fmtBRL(amount_cents)}\n📝 ${params.descricao}\n🏢 ${company.name}`
}

// ─── Definição das tools para o Claude ───────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_dre',
    description: 'Consulta o DRE (Demonstração do Resultado) de um período. Retorna receita, custos, lucro bruto, lucro líquido e margens.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodo: { type: 'string', description: 'Período: "mes_atual", "trimestre", "ano", "semana" ou "YYYY-MM"' },
        empresa: { type: 'string', description: 'Nome (parcial) da empresa. Se omitido, consolida todas.' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'listar_transacoes',
    description: 'Lista as transações mais recentes. Pode filtrar por tipo (receita/despesa), período e empresa.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodo:  { type: 'string', description: 'Período: "mes_atual", "semana", "ano" ou "YYYY-MM"' },
        tipo:     { type: 'string', enum: ['receita', 'despesa'], description: 'Filtrar por tipo (opcional)' },
        limite:   { type: 'number', description: 'Quantidade máxima (padrão 10, máx 20)' },
        empresa:  { type: 'string', description: 'Nome parcial da empresa (opcional)' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'resumo_kpis',
    description: 'Retorna um resumo rápido dos principais KPIs: receita, lucro, margem, ticket médio, total de lançamentos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodo: { type: 'string', description: 'Período: "mes_atual", "trimestre", "ano", "semana"' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'criar_transacao',
    description: 'Cria um novo lançamento financeiro (receita ou despesa).',
    input_schema: {
      type: 'object' as const,
      properties: {
        empresa:   { type: 'string', description: 'Nome (parcial) da empresa' },
        tipo:      { type: 'string', enum: ['receita', 'despesa'] },
        valor:     { type: 'number', description: 'Valor em R$ (ex: 1500.00)' },
        descricao: { type: 'string', description: 'Descrição do lançamento' },
        data:      { type: 'string', description: 'Data YYYY-MM-DD (padrão: hoje)' },
      },
      required: ['empresa', 'tipo', 'valor', 'descricao'],
    },
  },
]

// ─── Processamento com Claude ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o assistente financeiro do Finance Master, um sistema de gestão de holding multi-CNPJ.
Você responde perguntas sobre o desempenho financeiro das empresas de forma direta e objetiva.
Use as ferramentas disponíveis para consultar dados reais do banco de dados.
Responda sempre em português brasileiro, de forma concisa e clara para mensagem de WhatsApp.
Use emojis com moderação para melhorar a legibilidade.
Para valores monetários, use sempre o formato R$ X.XXX,XX.
Se o usuário pedir para criar um lançamento, confirme o que foi criado.
Nunca invente dados — sempre use as ferramentas para buscar informações reais.
Se não entender a pergunta, peça esclarecimento de forma simples.`

async function processWithClaude(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]

  // Loop de tool use (até 5 iterações)
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages,
    })

    // Se parou por tool_use, executa as ferramentas
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
        } catch (e) {
          result = `Erro na ferramenta: ${e instanceof Error ? e.message : String(e)}`
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Resposta final de texto
    const text = response.content.find(b => b.type === 'text')
    return text?.type === 'text' ? text.text : '❓ Não consegui processar sua solicitação.'
  }
  return '⚠️ Muitas iterações. Tente uma pergunta mais simples.'
}

// ─── WhatsApp API ─────────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, text: string): Promise<void> {
  await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type:    'text',
      text:    { body: text, preview_url: false },
    }),
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Verificação do webhook (GET) ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') return res.status(405).end()

  // Responde 200 imediatamente (WhatsApp exige < 5s)
  res.status(200).end()

  try {
    const body = req.body as {
      object?: string
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              type: string; from: string; id: string
              text?: { body: string }
            }>
          }
        }>
      }>
    }

    if (body.object !== 'whatsapp_business_account') return
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message || message.type !== 'text' || !message.text?.body) return

    const from = message.from
    const text = message.text.body.trim()

    // Verifica se o número está na lista de autorizados
    if (ALLOWED.length > 0 && !ALLOWED.includes(from)) {
      await sendWhatsApp(from, '🔒 Acesso não autorizado.\nEste assistente é privado.')
      return
    }

    console.log(`[WhatsApp] Mensagem de ${from}: ${text}`)

    // Comandos rápidos sem Claude
    const lower = text.toLowerCase()
    if (lower === 'ajuda' || lower === 'help' || lower === '/ajuda') {
      await sendWhatsApp(from, [
        '🤖 *Finance Master — Assistente*',
        '',
        'Exemplos do que você pode perguntar:',
        '• "qual o DRE do mês?"',
        '• "mostra os KPIs do trimestre"',
        '• "últimas 5 despesas"',
        '• "receita de janeiro"',
        '• "criar despesa: aluguel 3500 empresa ABC"',
        '• "lucro do ano"',
        '',
        'Os dados são consultados em tempo real.',
      ].join('\n'))
      return
    }

    // Processa com Claude
    const reply = await processWithClaude(text)
    await sendWhatsApp(from, reply)

  } catch (e) {
    console.error('[WhatsApp] Erro:', e)
    // Não podemos mais responder ao request (já fizemos res.end())
  }
}
