import Decimal from 'decimal.js'
import type { FinancialEntry } from '../types/finance.types'
import type { ChartAccountV2, AccountClass } from './corporateChartApi'

// ──────────────────────────────────────────────────────────────────────────────
// Tipos de resultado
// ──────────────────────────────────────────────────────────────────────────────

export interface IFRSDREResult {
  // Receitas
  receitaBruta: Decimal
  deducoes: Decimal
  receitaLiquida: Decimal      // calculada: receitaBruta - deducoes

  // Custo
  cpv: Decimal
  lucroBruto: Decimal          // calculada: receitaLiquida - cpv

  // Despesas operacionais
  despesasComerciais: Decimal
  despesasAdministrativas: Decimal
  despesasFinanceiras: Decimal
  totalDespesasOperacionais: Decimal

  // EBIT (Lucro Operacional)
  ebit: Decimal                // calculada: lucroBruto - totalDespesasOperacionais

  // D&A (somadas de volta para EBITDA)
  depreciacao: Decimal
  amortizacao: Decimal
  ebitda: Decimal              // calculada: ebit + depreciacao + amortizacao

  // Abaixo do EBIT
  despesasNaoOperacionais: Decimal
  receitasNaoOperacionais: Decimal
  lucroAntesImpostos: Decimal  // calculada: ebit - despesasNaoOp + receitasNaoOp

  // Impostos
  irpj: Decimal
  csll: Decimal
  totalImpostos: Decimal

  // Resultado final
  lucroLiquido: Decimal        // calculada: lucroAntesImpostos - totalImpostos

  // KPIs (percentuais)
  margemBruta: Decimal
  margemEBIT: Decimal
  margemEBITDA: Decimal
  margemLiquida: Decimal

  // Metadados
  period: { from: string; to: string }
  totalEntries: number
}

export interface IFRSKPIs {
  margemBruta: Decimal
  margemOperacional: Decimal
  margemEBITDA: Decimal
  margemLiquida: Decimal
  roe: Decimal | null          // requer patrimonioLiquido
  roa: Decimal | null          // requer ativoTotal
  crescimentoReceita: Decimal | null    // requer período anterior
  crescimentoEBITDA: Decimal | null
}

export interface AccountingEquationResult {
  balanced: boolean
  assets: Decimal
  liabilities: Decimal
  equity: Decimal
  delta: Decimal               // assets - (liabilities + equity); ≈0 se balanceado
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

const ZERO = new Decimal(0)
const TOLERANCE = new Decimal('0.01')

function d(value: number | string): Decimal {
  return new Decimal(value)
}

function isActive(entry: FinancialEntry): boolean {
  return entry.status !== 'cancelled'
}

function inPeriod(entry: FinancialEntry, from: string, to: string): boolean {
  return entry.competence_date >= from && entry.competence_date <= to
}

function findAccount(
  accountId: string,
  accounts: ChartAccountV2[]
): ChartAccountV2 | undefined {
  return accounts.find((a) => a.id === accountId)
}

function isAccountClass(account: ChartAccountV2, cls: AccountClass): boolean {
  return account.account_class === cls
}

function isDAAccount(account: ChartAccountV2): boolean {
  // D&A são contas cujo account_type começa com 'depreciation' ou 'amortization'
  // Ou que estão no grupo 5.3.2.5 / 5.1.3.6
  return (
    account.account_type.startsWith('depreciation') ||
    account.account_type.startsWith('amortization') ||
    account.account_code === '5.3.2.5' ||
    account.account_code.startsWith('5.3.2.5.') ||
    account.account_code === '5.1.3.6' ||
    account.account_code.startsWith('5.1.3.6.')
  )
}

function sumEntries(entries: FinancialEntry[]): Decimal {
  return entries.reduce((acc, e) => acc.plus(d(e.amount)), ZERO)
}

// ──────────────────────────────────────────────────────────────────────────────
// Engine principal — IFRS DRE cascade
// ──────────────────────────────────────────────────────────────────────────────

export function calculateIFRSDRE(
  entries: FinancialEntry[],
  accounts: ChartAccountV2[],
  period: { from: string; to: string }
): IFRSDREResult {
  const relevant = entries.filter(
    (e) => isActive(e) && inPeriod(e, period.from, period.to)
  )

  // Buckets por tipo de conta
  const revenueEntries: FinancialEntry[] = []
  const deductionEntries: FinancialEntry[] = []
  const cpvEntries: FinancialEntry[] = []
  const commercialEntries: FinancialEntry[] = []
  const adminEntries: FinancialEntry[] = []
  const financialExpenseEntries: FinancialEntry[] = []
  const daEntries: FinancialEntry[] = []
  const nonOpExpenseEntries: FinancialEntry[] = []
  const nonOpRevenueEntries: FinancialEntry[] = []
  const taxEntries: FinancialEntry[] = []

  for (const entry of relevant) {
    // Sem vínculo com conta V2 → classificar por type da entrada (receivable/payable)
    if (!entry.chart_account_v2_id) {
      if (entry.type === 'receivable') revenueEntries.push(entry)
      else if (entry.type === 'payable') adminEntries.push(entry)
      continue
    }

    const account = findAccount(entry.chart_account_v2_id, accounts)
    if (!account) {
      // Conta V2 não encontrada → fallback por type
      if (entry.type === 'receivable') revenueEntries.push(entry)
      else if (entry.type === 'payable') adminEntries.push(entry)
      continue
    }

    const code = account.account_code
    const atype = account.account_type

    // Roteamento por account_type (plano genérico) com fallback em account_code (plano IFRS 4.x/5.x)
    if (isAccountClass(account, 'REVENUE')) {
      if (atype === 'receita') revenueEntries.push(entry)
      else if (atype === 'deducao') deductionEntries.push(entry)
      else if (atype === 'receita_nao_op') nonOpRevenueEntries.push(entry)
      // fallback código 4.x
      else if (code.startsWith('4.1')) revenueEntries.push(entry)
      else if (code.startsWith('4.2')) deductionEntries.push(entry)
      else if (code.startsWith('4.4')) nonOpRevenueEntries.push(entry)
      else revenueEntries.push(entry)
      continue
    }

    if (isAccountClass(account, 'EXPENSE')) {
      if (isDAAccount(account)) { daEntries.push(entry); continue }
      if (atype === 'cpv') cpvEntries.push(entry)
      else if (atype === 'despesa_operacional') adminEntries.push(entry)
      else if (atype === 'despesa_financeira') financialExpenseEntries.push(entry)
      else if (atype === 'nao_operacional') nonOpExpenseEntries.push(entry)
      // fallback código 5.x
      else if (code.startsWith('5.1')) cpvEntries.push(entry)
      else if (code.startsWith('5.3.1')) commercialEntries.push(entry)
      else if (code.startsWith('5.3.2')) adminEntries.push(entry)
      else if (code.startsWith('5.3.3')) financialExpenseEntries.push(entry)
      else if (code.startsWith('5.6')) nonOpExpenseEntries.push(entry)
      else if (code.startsWith('5.8')) taxEntries.push(entry)
      else adminEntries.push(entry)
    }
  }

  // ── Cálculos cascata IFRS ──────────────────────────────────────────────────
  const receitaBruta = sumEntries(revenueEntries)
  const deducoes = sumEntries(deductionEntries)
  const receitaLiquida = receitaBruta.minus(deducoes)

  const cpv = sumEntries(cpvEntries)
  const lucroBruto = receitaLiquida.minus(cpv)

  const despesasComerciais = sumEntries(commercialEntries)
  const despesasAdministrativas = sumEntries(adminEntries)
  const despesasFinanceiras = sumEntries(financialExpenseEntries)
  const totalDespesasOperacionais = despesasComerciais
    .plus(despesasAdministrativas)
    .plus(despesasFinanceiras)

  // EBIT = Lucro Bruto - Total Despesas Operacionais
  const ebit = lucroBruto.minus(totalDespesasOperacionais)

  // EBITDA = EBIT + D&A (add-back)
  const daParts = sumEntries(daEntries)
  const depreciacao = daParts  // simplificado — pode ser separado em versão futura
  const amortizacao = ZERO
  const ebitda = ebit.plus(depreciacao).plus(amortizacao)

  // Abaixo do EBIT
  const despesasNaoOperacionais = sumEntries(nonOpExpenseEntries)
  const receitasNaoOperacionais = sumEntries(nonOpRevenueEntries)
  const lucroAntesImpostos = ebit
    .minus(despesasNaoOperacionais)
    .plus(receitasNaoOperacionais)

  // Impostos
  const totalImpostos = sumEntries(taxEntries)
  const lucroLiquido = lucroAntesImpostos.minus(totalImpostos)

  // KPIs (percentuais 0–100)
  const pct = (num: Decimal, den: Decimal): Decimal =>
    den.isZero() ? ZERO : num.dividedBy(den).times(100)

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    cpv,
    lucroBruto,
    despesasComerciais,
    despesasAdministrativas,
    despesasFinanceiras,
    totalDespesasOperacionais,
    ebit,
    depreciacao,
    amortizacao,
    ebitda,
    despesasNaoOperacionais,
    receitasNaoOperacionais,
    lucroAntesImpostos,
    irpj: ZERO,   // discriminado futuramente por código 5.8.1.1
    csll: ZERO,
    totalImpostos,
    lucroLiquido,
    margemBruta:    pct(lucroBruto,   receitaLiquida),
    margemEBIT:     pct(ebit,          receitaLiquida),
    margemEBITDA:   pct(ebitda,        receitaLiquida),
    margemLiquida:  pct(lucroLiquido,  receitaLiquida),
    period,
    totalEntries: relevant.length,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// KPIs para investidores
// ──────────────────────────────────────────────────────────────────────────────

export function calcIFRSKPIs(
  dre: IFRSDREResult,
  options?: {
    patrimonioLiquido?: number
    ativoTotal?: number
    periodoAnterior?: IFRSDREResult
  }
): IFRSKPIs {
  const pct = (num: Decimal, den: Decimal) =>
    den.isZero() ? ZERO : num.dividedBy(den).times(100)

  const pctGrowth = (current: Decimal, previous: Decimal) =>
    previous.isZero() ? null : current.minus(previous).dividedBy(previous.abs()).times(100)

  const roe = options?.patrimonioLiquido
    ? pct(dre.lucroLiquido, d(options.patrimonioLiquido))
    : null

  const roa = options?.ativoTotal
    ? pct(dre.lucroLiquido, d(options.ativoTotal))
    : null

  const crescimentoReceita = options?.periodoAnterior
    ? pctGrowth(dre.receitaLiquida, options.periodoAnterior.receitaLiquida)
    : null

  const crescimentoEBITDA = options?.periodoAnterior
    ? pctGrowth(dre.ebitda, options.periodoAnterior.ebitda)
    : null

  return {
    margemBruta:       dre.margemBruta,
    margemOperacional: dre.margemEBIT,
    margemEBITDA:      dre.margemEBITDA,
    margemLiquida:     dre.margemLiquida,
    roe,
    roa,
    crescimentoReceita,
    crescimentoEBITDA,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Validação da equação contábil (Story 1.5)
// ──────────────────────────────────────────────────────────────────────────────

export function validateAccountingEquation(
  accounts: ChartAccountV2[],
  getBalance: (account: ChartAccountV2) => Decimal
): AccountingEquationResult {
  const activeAccounts = accounts.filter((a) => a.is_active && !a.is_calculated)

  let assets = ZERO
  let liabilities = ZERO
  let equity = ZERO

  for (const account of activeAccounts) {
    const balance = getBalance(account)
    if (account.account_class === 'ASSET')     assets = assets.plus(balance)
    if (account.account_class === 'LIABILITY') liabilities = liabilities.plus(balance)
    if (account.account_class === 'EQUITY')    equity = equity.plus(balance)
  }

  const delta = assets.minus(liabilities.plus(equity)).abs()
  const balanced = delta.lessThanOrEqualTo(TOLERANCE)

  return { balanced, assets, liabilities, equity, delta }
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilitários de formatação
// ──────────────────────────────────────────────────────────────────────────────

export function fmtDecimal(value: Decimal, decimals = 2): string {
  return value.toFixed(decimals)
}

export function decimalToNumber(value: Decimal): number {
  return value.toNumber()
}
