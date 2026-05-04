import type { ChartAccountV2 } from './corporateChartApi'
import type { FinancialEntry } from '../types/finance.types'

export interface BPLine {
  account: ChartAccountV2
  balance: number
  children: BPLine[]
}

export interface BalanceSheet {
  ativo: {
    circulante: BPLine[]
    naoCirculante: BPLine[]
    total: number
  }
  passivo: {
    circulante: BPLine[]
    naoCirculante: BPLine[]
    total: number
  }
  patrimonioLiquido: BPLine[]
  totalPassivoEPL: number
  isBalanced: boolean
  delta: number
}

export interface LiquidityIndicators {
  liquidezCorrente: number | null
  liquidezSeca: number | null
  liquidezGeral: number | null
  endividamento: number | null
  capitalDeGiro: number
}

// Calcula saldo de uma conta a partir dos lançamentos vinculados ao chart_account_v2_id
export function buildAccountBalances(
  accounts: ChartAccountV2[],
  entries: FinancialEntry[]
): Map<string, number> {
  const balances = new Map<string, number>()

  // Inicializa todos os saldos com zero
  for (const acc of accounts) {
    balances.set(acc.id, 0)
  }

  // Soma lançamentos por conta (só ativos, não cancelados)
  for (const entry of entries) {
    if (entry.status === 'cancelled') continue
    const accountId = (entry as { chart_account_v2_id?: string }).chart_account_v2_id
    if (!accountId || !balances.has(accountId)) continue

    const value = (entry.amount ?? 0) / 100  // converte centavos para reais
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc) continue

    // Débito aumenta Ativo/Despesa; Crédito aumenta Passivo/PL/Receita
    balances.set(accountId, (balances.get(accountId) ?? 0) + value)
  }

  // Propaga saldos para contas pai (hierarquia)
  const sortedByLevel = [...accounts].sort((a, b) => b.level - a.level)
  for (const acc of sortedByLevel) {
    if (!acc.parent_account_id) continue
    const parentBalance = (balances.get(acc.parent_account_id) ?? 0) + (balances.get(acc.id) ?? 0)
    balances.set(acc.parent_account_id, parentBalance)
  }

  return balances
}

function buildTree(
  accounts: ChartAccountV2[],
  balances: Map<string, number>,
  parentId: string | null
): BPLine[] {
  return accounts
    .filter((a) => a.parent_account_id === parentId && a.is_active)
    .sort((a, b) => a.account_code.localeCompare(b.account_code))
    .map((acc) => ({
      account: acc,
      balance: balances.get(acc.id) ?? 0,
      children: buildTree(accounts, balances, acc.id),
    }))
}

function sumTree(lines: BPLine[]): number {
  return lines.reduce((sum, l) => sum + l.balance, 0)
}

// Separa em circulante/não-circulante pelo account_type ou pelo primeiro nível de código
function isCirculante(acc: ChartAccountV2): boolean {
  const lowerType = (acc.account_type ?? '').toLowerCase()
  const lowerName = acc.account_name.toLowerCase()
  return (
    lowerType.includes('circulante') ||
    lowerName.includes('circulante') ||
    // Por convenção IFRS: código X.1 = circulante, X.2 = não-circulante
    acc.account_code.match(/^\d+\.1(\.|$)/) !== null
  )
}

export function calculateBalanceSheet(
  accounts: ChartAccountV2[],
  entries: FinancialEntry[]
): BalanceSheet {
  const balances = buildAccountBalances(accounts, entries)

  const ativoTree = buildTree(accounts, balances, null).filter((l) => l.account.account_class === 'ASSET')
  const passivoTree = buildTree(accounts, balances, null).filter((l) => l.account.account_class === 'LIABILITY')
  const plTree = buildTree(accounts, balances, null).filter((l) => l.account.account_class === 'EQUITY')

  // Separa circulante e não-circulante nos filhos
  const ativoCirc = ativoTree.flatMap((l) => l.children.filter((c) => isCirculante(c.account)))
  const ativoNaoCirc = ativoTree.flatMap((l) => l.children.filter((c) => !isCirculante(c.account)))
  const passivoCirc = passivoTree.flatMap((l) => l.children.filter((c) => isCirculante(c.account)))
  const passivoNaoCirc = passivoTree.flatMap((l) => l.children.filter((c) => !isCirculante(c.account)))

  const totalAtivo = sumTree(ativoTree)
  const totalPassivo = sumTree(passivoTree)
  const totalPL = sumTree(plTree)
  const totalPassivoEPL = totalPassivo + totalPL

  const delta = Math.abs(totalAtivo - totalPassivoEPL)
  const isBalanced = delta < 0.01

  return {
    ativo: { circulante: ativoCirc, naoCirculante: ativoNaoCirc, total: totalAtivo },
    passivo: { circulante: passivoCirc, naoCirculante: passivoNaoCirc, total: totalPassivo },
    patrimonioLiquido: plTree,
    totalPassivoEPL,
    isBalanced,
    delta,
  }
}

export function calculateLiquidity(bs: BalanceSheet): LiquidityIndicators {
  const ativoCirc = sumTree(bs.ativo.circulante)
  const passivoCirc = sumTree(bs.passivo.circulante)
  const passivoTotal = bs.passivo.total + sumTree(bs.patrimonioLiquido)

  // Estimativa de estoques = 30% do ativo circulante (sem dados específicos no BP simplificado)
  const estoqueEstimado = ativoCirc * 0.3

  const liquidezCorrente = passivoCirc !== 0 ? ativoCirc / passivoCirc : null
  const liquidezSeca = passivoCirc !== 0 ? (ativoCirc - estoqueEstimado) / passivoCirc : null
  const liquidezGeral = (passivoCirc + sumTree(bs.passivo.naoCirculante)) !== 0
    ? (ativoCirc + sumTree(bs.ativo.naoCirculante)) / (passivoCirc + sumTree(bs.passivo.naoCirculante))
    : null
  const endividamento = passivoTotal !== 0 ? (bs.passivo.total / passivoTotal) * 100 : null
  const capitalDeGiro = ativoCirc - passivoCirc

  return { liquidezCorrente, liquidezSeca, liquidezGeral, endividamento, capitalDeGiro }
}
