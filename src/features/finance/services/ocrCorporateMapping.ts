import type { ChartAccountV2 } from './corporateChartApi'

// Palavras-chave para mapear texto OCR → classe de conta corporativa
const KEYWORD_PATTERNS: Array<{ pattern: RegExp; keywords: string[] }> = [
  {
    // Custos de mercadorias / matéria-prima → EXPENSE > CPV
    keywords: ['matéria prima', 'insumo', 'material', 'tecido', 'plástico', 'cpv', 'cmv', 'custo produto', 'custo mercadoria'],
    pattern: /materi[aá]|insumo|tecido|pl[aá]stico|cpv|cmv|custo.?(produto|mercadoria)/i,
  },
  {
    // Frete / logística
    keywords: ['correios', 'sedex', 'jadlog', 'total express', 'loggi', 'transportadora', 'frete'],
    pattern: /correios|sedex|jadlog|total express|loggi|transportadora|frete/i,
  },
  {
    // Marketing / publicidade
    keywords: ['google ads', 'meta ads', 'facebook ads', 'tiktok ads', 'publicidade', 'marketing'],
    pattern: /google ads|meta ads|facebook ads|tiktok ads|publicidade|marketing/i,
  },
  {
    // Aluguel / imóveis
    keywords: ['aluguel', 'condomínio', 'iptu', 'locação'],
    pattern: /aluguel|condom[íi]nio|iptu|loca[çc][ãa]o/i,
  },
  {
    // Serviços contábeis / profissionais
    keywords: ['contador', 'contábil', 'escritório contábil', 'advocacia', 'assessoria'],
    pattern: /cont[aá]b|contador|advoca|assessoria/i,
  },
  {
    // Tarifas bancárias / financeiro
    keywords: ['banco', 'tarifa', 'iof', 'juros', 'empréstimo', 'financiamento'],
    pattern: /banco|bradesco|ita[uú]|santander|tarifa|iof|juros|empr[eé]stimo|financiamento/i,
  },
  {
    // Embalagens
    keywords: ['embalagem', 'caixa', 'envelope', 'fita adesiva', 'plástico bolha'],
    pattern: /embalagem|caixa|envelope|fita/i,
  },
  {
    // Marketplace / vendas online (receita)
    keywords: ['amazon', 'mercado livre', 'shopify', 'vtex', 'loja integrada', 'ifood'],
    pattern: /amazon|mercado livre|shopify|vtex|loja integrada|ifood/i,
  },
  {
    // Salários / folha
    keywords: ['salário', 'folha', 'holerite', 'férias', '13º', 'rescisão'],
    pattern: /sal[aá]rio|folha|holerite|f[eé]rias|13|rescis[aã]o/i,
  },
  {
    // Energia / utilidades
    keywords: ['energia', 'eletricidade', 'água', 'saneamento', 'telecom', 'internet'],
    pattern: /energia|eletricidade|[aá]gua|saneamento|telecom|internet/i,
  },
]

// Mapeia padrão de keyword para termos de busca nas contas corporativas
const PATTERN_TO_ACCOUNT_KEYWORDS: Record<number, string[]> = {
  0: ['custo', 'cpv', 'cmv', 'mercadoria', 'matéria'],
  1: ['frete', 'logística', 'transporte'],
  2: ['marketing', 'publicidade', 'propaganda'],
  3: ['aluguel', 'imóvel', 'locação'],
  4: ['serviço', 'profissional', 'contábil'],
  5: ['financeiro', 'bancário', 'juros'],
  6: ['embalagem', 'material'],
  7: ['receita', 'venda', 'faturamento'],
  8: ['pessoal', 'salário', 'folha'],
  9: ['utilidade', 'energia', 'água'],
}

function accountMatchesKeywords(account: ChartAccountV2, keywords: string[]): boolean {
  const text = `${account.account_code} ${account.account_name} ${account.description ?? ''}`.toLowerCase()
  return keywords.some((kw) => text.includes(kw.toLowerCase()))
}

export function suggestCorporateAccount(
  ocrText: string,
  accounts: ChartAccountV2[]
): ChartAccountV2 | null {
  if (!accounts.length || !ocrText) return null

  // Apenas contas folha (não calculadas, sem filhos — i.e., sem filhos diretos)
  const leafAccounts = accounts.filter((a) => {
    if (a.is_calculated) return false
    // Conta é folha se nenhuma outra conta tem ela como prefixo + "."
    const prefix = a.account_code + '.'
    return !accounts.some((other) => other.account_code.startsWith(prefix))
  })

  if (!leafAccounts.length) return null

  const lower = ocrText.toLowerCase()

  for (let i = 0; i < KEYWORD_PATTERNS.length; i++) {
    const { pattern } = KEYWORD_PATTERNS[i]
    if (!pattern.test(lower)) continue

    const searchKeywords = PATTERN_TO_ACCOUNT_KEYWORDS[i] ?? []
    const match = leafAccounts.find((a) => accountMatchesKeywords(a, searchKeywords))
    if (match) return match
  }

  return null
}

// Agrupa contas corporativas por classe para exibição no select
export function groupAccountsByClass(accounts: ChartAccountV2[]): Map<string, ChartAccountV2[]> {
  const groups = new Map<string, ChartAccountV2[]>()
  for (const account of accounts) {
    const cls = account.account_class
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)!.push(account)
  }
  return groups
}

export const CLASS_LABELS: Record<string, string> = {
  ASSET: 'Ativo',
  LIABILITY: 'Passivo',
  EQUITY: 'Patrimônio Líquido',
  REVENUE: 'Receitas',
  EXPENSE: 'Despesas e Custos',
}
