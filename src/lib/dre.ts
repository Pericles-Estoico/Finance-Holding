import Decimal from 'decimal.js'
import type { Transaction, AccountCategory } from '../types'
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
  lucroLiquido: number
  margemBruta: number
  margemLiquida: number
  receitaPorCanal: Record<string, number>
  lines: DRELine[]
}

export function calcDRE(
  transactions: Transaction[],
  accounts: AccountCategory[]
): DREResult {
  const accountMap = new Map(accounts.map(a => [a.id, a]))

  // Agrupa transações por tipo de conta
  const byType: Record<string, Transaction[]> = {
    receita: [],
    deducao: [],
    cmv: [],
    despesa_operacional: [],
    imposto: [],
  }

  for (const tx of transactions) {
    const acc = accountMap.get(tx.account_id)
    if (!acc) continue
    if (acc.type === 'receita') {
      // Deduções têm código começando com 1.0
      if (acc.code.startsWith('1.0')) byType.deducao.push(tx)
      else byType.receita.push(tx)
    } else if (acc.type === 'cmv') byType.cmv.push(tx)
    else if (acc.type === 'despesa_operacional') byType.despesa_operacional.push(tx)
    else if (acc.type === 'imposto') byType.imposto.push(tx)
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
  const lucroLiquido = new Decimal(lucroOp).minus(impostos).toNumber()

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
    const grouped = new Map<string, { acc: AccountCategory; total: number }>()
    for (const tx of txs) {
      const acc = accountMap.get(tx.account_id)
      if (!acc) continue
      const cur = grouped.get(acc.id)
      grouped.set(acc.id, {
        acc,
        total: new Decimal(cur?.total ?? 0).plus(tx.amount_cents).toNumber(),
      })
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.acc.code.localeCompare(b.acc.code))
      .map(({ acc, total }) => ({
        code: acc.code,
        label: acc.name,
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
      code: '4', label: '(-) Impostos', amountCents: impostos, sign: -1,
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
    impostos, lucroLiquido,
    margemBruta, margemLiquida,
    receitaPorCanal,
    lines,
  }
}

export { formatBRL, formatPercent }
