import type {
  FinancialEntry,
  ChartAccount,
  DateRange,
  DreResult,
  EbitdaResult,
  CashFlowProjection,
  CashFlowDayRow,
} from '../types/finance.types'

function isInRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

function getAccountForEntry(
  entry: FinancialEntry,
  chartAccounts: ChartAccount[]
): ChartAccount | undefined {
  return chartAccounts.find((a) => a.id === entry.chart_account_id)
}

export function calculateDRE(
  entries: FinancialEntry[],
  chartAccounts: ChartAccount[],
  period: DateRange
): DreResult {
  const relevant = entries.filter(
    (e) =>
      e.status !== 'cancelled' &&
      isInRange(e.competence_date, period.from, period.to)
  )

  const byGroup: Record<string, number> = {}
  const entriesByGroup: Record<string, FinancialEntry[]> = {}

  for (const entry of relevant) {
    const account = getAccountForEntry(entry, chartAccounts)
    if (!account || !account.affects_dre || !account.dre_group) continue

    const group = account.dre_group
    byGroup[group] = (byGroup[group] ?? 0) + entry.amount
    if (!entriesByGroup[group]) entriesByGroup[group] = []
    entriesByGroup[group].push(entry)
  }

  const receitaBruta = byGroup['gross_revenue'] ?? 0
  const deducoes = byGroup['revenue_deductions'] ?? 0
  const receitaLiquida = receitaBruta - deducoes
  const cmv = byGroup['cogs'] ?? 0
  const lucroBruto = receitaLiquida - cmv
  const despesasComerciais = byGroup['commercial_expenses'] ?? 0
  const despesasAdministrativas = byGroup['administrative_expenses'] ?? 0
  const despesasOperacionais = byGroup['operational_expenses'] ?? 0
  const totalDespesasOperacionais = despesasComerciais + despesasAdministrativas + despesasOperacionais
  const ebitda = lucroBruto - totalDespesasOperacionais
  const depreciacao = byGroup['depreciation_amortization'] ?? 0
  const ebit = ebitda - depreciacao

  const financialResultEntries = (entriesByGroup['financial_result'] ?? [])
  let resultadoFinanceiro = 0
  for (const fe of financialResultEntries) {
    const acc = getAccountForEntry(fe, chartAccounts)
    if (!acc) continue
    if (acc.account_type === 'financial_income') {
      resultadoFinanceiro += fe.amount
    } else {
      resultadoFinanceiro -= fe.amount
    }
  }

  const impostos = byGroup['taxes_on_profit'] ?? 0
  const lucroLiquido = ebit + resultadoFinanceiro - impostos

  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0
  const margemEbitda = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasComerciais,
    despesasAdministrativas,
    despesasOperacionais,
    totalDespesasOperacionais,
    ebitda,
    depreciacao,
    ebit,
    resultadoFinanceiro,
    impostos,
    lucroLiquido,
    margemBruta,
    margemEbitda,
    margemLiquida,
    byGroup,
    entriesByGroup,
  }
}

export function calculateEBITDA(
  dreResult: DreResult,
  entries: FinancialEntry[],
  chartAccounts: ChartAccount[]
): EbitdaResult {
  const byGroup: Record<string, number> = {}
  const groupEntries: Record<string, FinancialEntry[]> = {}
  const excludedGroups: Set<string> = new Set()

  for (const entry of entries) {
    if (entry.status === 'cancelled') continue
    const account = getAccountForEntry(entry, chartAccounts)
    if (!account) continue

    if (account.affects_ebitda && account.ebitda_group && account.ebitda_group !== 'excluded_from_ebitda') {
      const group = account.ebitda_group
      byGroup[group] = (byGroup[group] ?? 0) + entry.amount
      if (!groupEntries[group]) groupEntries[group] = []
      groupEntries[group].push(entry)
    } else if (account.dre_group) {
      excludedGroups.add(account.dre_group)
    }
  }

  const netRevenue = dreResult.receitaLiquida
  const cogs = byGroup['cogs'] ?? 0
  const grossProfit = netRevenue - cogs
  const eligibleExpenses =
    (byGroup['commercial_expenses'] ?? 0) +
    (byGroup['administrative_expenses'] ?? 0) +
    (byGroup['operational_expenses'] ?? 0)
  const ebitda = grossProfit - eligibleExpenses
  const ebitdaMargin = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0

  const excludedItems = Array.from(excludedGroups).map((group) => ({
    group,
    amount: dreResult.byGroup[group] ?? 0,
    entries: dreResult.entriesByGroup[group] ?? [],
  }))

  return {
    netRevenue,
    cogs,
    grossProfit,
    eligibleExpenses,
    ebitda,
    ebitdaMargin,
    excludedItems,
    byGroup,
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getBalanceStatus(balance: number, initialBalance: number): 'healthy' | 'warning' | 'critical' {
  if (balance < 0) return 'critical'
  if (initialBalance > 0 && balance / initialBalance < 0.1) return 'warning'
  return 'healthy'
}

export function calculateCashFlowProjection(
  entries: FinancialEntry[],
  initialCashBalance: number,
  startDate: string,
  endDate: string
): CashFlowProjection {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const rows: CashFlowDayRow[] = []

  let runningBalance = initialCashBalance
  const today = formatDate(new Date())

  const currentDate = new Date(start)
  while (currentDate <= end) {
    const dateStr = formatDate(currentDate)
    const dayEntries = entries.filter(
      (e) =>
        e.status !== 'cancelled' &&
        (e.due_date === dateStr || e.paid_or_received_date === dateStr)
    )

    let projectedInflow = 0
    let realizedInflow = 0
    let projectedOutflow = 0
    let realizedOutflow = 0

    for (const entry of dayEntries) {
      const isInflow = entry.type === 'receivable'
      const isRealized = entry.status === 'received' || entry.status === 'paid'

      if (dateStr <= today) {
        if (isRealized) {
          if (isInflow) realizedInflow += entry.amount
          else realizedOutflow += entry.amount
        }
      } else {
        if (entry.due_date === dateStr) {
          if (isInflow) projectedInflow += entry.amount
          else projectedOutflow += entry.amount
        }
        if (isRealized && entry.paid_or_received_date === dateStr) {
          if (isInflow) realizedInflow += entry.amount
          else realizedOutflow += entry.amount
        }
      }
    }

    const openingBalance = runningBalance
    const netFlow =
      (realizedInflow + projectedInflow) - (realizedOutflow + projectedOutflow)
    runningBalance += netFlow
    const closingBalance = runningBalance

    rows.push({
      date: dateStr,
      openingBalance,
      projectedInflow,
      realizedInflow,
      projectedOutflow,
      realizedOutflow,
      closingBalance,
      status: getBalanceStatus(closingBalance, initialCashBalance),
      entries: dayEntries,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  const getBalanceAtDay = (days: number): number => {
    const targetDate = formatDate(addDays(new Date(startDate), days))
    const row = rows.find((r) => r.date >= targetDate)
    return row ? row.closingBalance : (rows[rows.length - 1]?.closingBalance ?? initialCashBalance)
  }

  const negativeCashDays = rows.filter((r) => r.closingBalance < 0).length
  const lowestProjectedBalance = rows.reduce(
    (min, r) => Math.min(min, r.closingBalance),
    Infinity
  )
  const totalProjectedInflow = rows.reduce((s, r) => s + r.projectedInflow + r.realizedInflow, 0)
  const totalProjectedOutflow = rows.reduce((s, r) => s + r.projectedOutflow + r.realizedOutflow, 0)

  return {
    rows,
    initialBalance: initialCashBalance,
    projectedBalance7d: getBalanceAtDay(7),
    projectedBalance15d: getBalanceAtDay(15),
    projectedBalance30d: getBalanceAtDay(30),
    projectedBalance60d: getBalanceAtDay(60),
    projectedBalance90d: getBalanceAtDay(90),
    lowestProjectedBalance: lowestProjectedBalance === Infinity ? initialCashBalance : lowestProjectedBalance,
    negativeCashDays,
    totalProjectedInflow,
    totalProjectedOutflow,
  }
}

export function getMonthlyRevenueTrend(
  entries: FinancialEntry[],
  chartAccounts: ChartAccount[],
  months: number = 6
): Array<{ month: string; receita: number; despesa: number; ebitda: number }> {
  const result: Array<{ month: string; receita: number; despesa: number; ebitda: number }> = []
  const today = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const from = formatDate(d)
    const to = formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    const dre = calculateDRE(entries, chartAccounts, { from, to })
    result.push({
      month: monthLabel,
      receita: dre.receitaLiquida,
      despesa: dre.totalDespesasOperacionais + dre.cmv,
      ebitda: dre.ebitda,
    })
  }

  return result
}
