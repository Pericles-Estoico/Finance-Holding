import Decimal from 'decimal.js'
import type { Transaction, AccountCategory } from '../types'
import type { ChartAccountV2 } from '../features/finance/services/corporateChartApi'
import { sumCents, calcPercent, formatBRL, formatPercent } from './currency'

export interface DRELine {
  code: string
  label: string
  amountCents: number
  percentOfRevenue: number
  children?: DRELine[]
  isTotal?: boolean
  isSubtotal?: boolean
  sign?: 1 | -1
}

export interface DREResult {
  period: string
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  cmv: number
  lucroBruto: number
  despesasOperacionais: number
  lucroOperacional: number
  impostos: number
  despesasFinanceiras: number
  resultadoFinanceiro: number
  lucroLiquido: number
  margemBruta: number
  margemLiquida: number
  receitaPorCanal: Record<string, number>
  lines: DRELine[]
}

export function calcDRE(
  transactions: Transaction[],
  accounts: AccountCategory[],
  chartAccountsV2: ChartAccountV2[] = []
): DREResult {
  const accountMap = new Map(accounts.map(a => [a.id, a]))
  const v2AccountMap = new Map(chartAccountsV2.map(a => [a.id, a]))

  // Agrupa transações por tipo de conta
  const byType: Record<string, Transaction[]> = {
    receita: [],
    deducao: [],
    cmv: [],
    despesa_operacional: [],
    imposto: [],
    resultado_financeiro: [],
  }

  for (const tx of transactions) {
    // Tenta conta legada primeiro; fallback para conta V2 corporativa
    const acc = tx.account_id ? accountMap.get(tx.account_id) : undefined
    if (acc) {
      if (acc.type === 'receita') {
        if (acc.code.startsWith('1.0')) byType.deducao.push(tx)
        else byType.receita.push(tx)
      } else if (acc.type === 'cmv') byType.cmv.push(tx)
      else if (acc.type === 'despesa_operacional') byType.despesa_operacional.push(tx)
      else if (acc.type === 'imposto') byType.imposto.push(tx)
      continue
    }

    // Conta V2 corporativa (chart_accounts_v2) — mapeada por account_type
    const v2acc = tx.chart_account_v2_id ? v2AccountMap.get(tx.chart_account_v2_id) : undefined
    if (!v2acc) {
      // Sem conta vinculada: não classifica no DRE (evita contaminar linhas com CAPEX e outros não-operacionais)
      continue
    }
    switch (v2acc.account_type) {
      case 'receita':
        byType.receita.push(tx); break
      case 'receita_nao_op':
        // Receitas não-operacionais (financeiras) vão para resultado financeiro, não para receita bruta
        byType.resultado_financeiro.push(tx); break
      case 'deducao':
        byType.deducao.push(tx); break
      case 'cpv':
        byType.cmv.push(tx); break
      case 'despesa_operacional':
        byType.despesa_operacional.push(tx); break
      case 'despesa_financeira':
        // Despesas financeiras vão para resultado financeiro (linha separada), não para impostos
        byType.resultado_financeiro.push(tx); break
      // investimento, nao_operacional → não entram no DRE
    }
  }

  // Totais
  const receitaBruta = sumCents(byType.receita.map(t => t.amount_cents))
  const deducoes     = sumCents(byType.deducao.map(t => t.amount_cents))
  const receitaLiquida = new Decimal(receitaBruta).minus(deducoes).toNumber()
  const cmv          = sumCents(byType.cmv.map(t => t.amount_cents))
  const lucroBruto   = new Decimal(receitaLiquida).minus(cmv).toNumber()
  const despOp       = sumCents(byType.despesa_operacional.map(t => t.amount_cents))
  const lucroOp      = new Decimal(lucroBruto).minus(despOp).toNumber()
  const impostos     = sumCents(byType.imposto.map(t => t.amount_cents))
  // Resultado financeiro: receitas não-op somam, despesas financeiras subtraem
  const resultadoFinanceiro = byType.resultado_financeiro.reduce((acc, tx) => {
    const v2 = tx.chart_account_v2_id ? v2AccountMap.get(tx.chart_account_v2_id) : undefined
    const isIncome = v2 ? v2.account_type === 'receita_nao_op' : tx.type === 'receita'
    return isIncome ? acc + tx.amount_cents : acc - tx.amount_cents
  }, 0)
  const lucroLiquido = new Decimal(lucroOp).plus(resultadoFinanceiro).minus(impostos).toNumber()

  const margemBruta   = calcPercent(lucroBruto, receitaLiquida)
  const margemLiquida = calcPercent(lucroLiquido, receitaLiquida)

  // Receita por canal
  const receitaPorCanal: Record<string, number> = {}
  for (const tx of byType.receita) {
    const ch = tx.channel ?? 'outros'
    receitaPorCanal[ch] = new Decimal(receitaPorCanal[ch] ?? 0).plus(tx.amount_cents).toNumber()
  }

  // Drill-down por conta para cada grupo
  const drillDown = (txs: Transaction[]): DRELine[] => {
    const grouped = new Map<string, { label: string; code: string; total: number }>()
    for (const tx of txs) {
      const legacy = tx.account_id ? accountMap.get(tx.account_id) : undefined
      const v2 = tx.chart_account_v2_id ? v2AccountMap.get(tx.chart_account_v2_id) : undefined
      const id = legacy?.id ?? v2?.id
      const label = legacy?.name ?? v2?.account_name ?? ''
      const code = legacy?.code ?? v2?.account_code ?? ''
      if (!id) continue
      const cur = grouped.get(id)
      grouped.set(id, {
        label,
        code,
        total: new Decimal(cur?.total ?? 0).plus(tx.amount_cents).toNumber(),
      })
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(({ code, label, total }) => ({
        code,
        label,
        amountCents: total,
        percentOfRevenue: calcPercent(total, receitaLiquida || receitaBruta || 1),
      }))
  }

  const ref = receitaLiquida || receitaBruta || 1

  const lines: DRELine[] = [
    {
      code: '1', label: 'Receita Bruta', amountCents: receitaBruta,
      percentOfRevenue: calcPercent(receitaBruta, ref),
      children: drillDown(byType.receita),
    },
    {
      code: '1.0', label: '(-) Deduções', amountCents: deducoes, sign: -1,
      percentOfRevenue: calcPercent(deducoes, ref),
      children: drillDown(byType.deducao),
    },
    {
      code: 'RL', label: '(=) Receita Líquida', amountCents: receitaLiquida,
      percentOfRevenue: 100, isSubtotal: true,
    },
    {
      code: '2', label: '(-) CMV', amountCents: cmv, sign: -1,
      percentOfRevenue: calcPercent(cmv, ref),
      children: drillDown(byType.cmv),
    },
    {
      code: 'LB', label: '(=) Lucro Bruto', amountCents: lucroBruto,
      percentOfRevenue: calcPercent(lucroBruto, ref), isSubtotal: true,
    },
    {
      code: '3', label: '(-) Despesas Operacionais', amountCents: despOp, sign: -1,
      percentOfRevenue: calcPercent(despOp, ref),
      children: drillDown(byType.despesa_operacional),
    },
    {
      code: 'LO', label: '(=) Lucro Operacional', amountCents: lucroOp,
      percentOfRevenue: calcPercent(lucroOp, ref), isSubtotal: true,
    },
    {
      code: '4', label: '(+/-) Resultado Financeiro', amountCents: resultadoFinanceiro,
      percentOfRevenue: calcPercent(resultadoFinanceiro, ref),
      children: drillDown(byType.resultado_financeiro),
    },
    {
      code: '5', label: '(-) Impostos sobre Lucro', amountCents: impostos, sign: -1,
      percentOfRevenue: calcPercent(impostos, ref),
      children: drillDown(byType.imposto),
    },
    {
      code: 'LL', label: '(=) Lucro Líquido', amountCents: lucroLiquido,
      percentOfRevenue: calcPercent(lucroLiquido, ref), isTotal: true,
    },
  ]

  return {
    period: '',
    receitaBruta, deducoes, receitaLiquida,
    cmv, lucroBruto,
    despesasOperacionais: despOp, lucroOperacional: lucroOp,
    impostos, despesasFinanceiras: impostos,
    resultadoFinanceiro,
    lucroLiquido,
    margemBruta, margemLiquida,
    receitaPorCanal,
    lines,
  }
}

export { formatBRL, formatPercent }
