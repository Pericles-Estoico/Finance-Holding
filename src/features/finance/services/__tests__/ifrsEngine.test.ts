import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  calculateIFRSDRE,
  calcIFRSKPIs,
  validateAccountingEquation,
} from '../ifrsEngine'
import type { IFRSDREResult } from '../ifrsEngine'
import type { ChartAccountV2 } from '../corporateChartApi'
import type { FinancialEntry } from '../../types/finance.types'

// ──────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────

function makeAccount(
  id: string,
  code: string,
  cls: ChartAccountV2['account_class'],
  type = 'regular'
): ChartAccountV2 {
  return {
    id,
    account_code: code,
    account_name: `Conta ${code}`,
    description: null,
    account_class: cls,
    account_type: type,
    normal_balance: cls === 'REVENUE' ? 'credit' : 'debit',
    parent_account_id: null,
    level: code.split('.').length,
    is_calculated: false,
    is_active: true,
    company_id: 'co-1',
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeEntry(
  id: string,
  accountId: string,
  amount: number,
  date = '2026-04-15'
): FinancialEntry {
  return {
    id,
    company_id: 'co-1',
    type: 'payable',
    amount,
    description: `Entry ${id}`,
    competence_date: date,
    due_date: date,
    status: 'paid',
    chart_account_id: null as unknown as string,
    chart_account_v2_id: accountId,
    created_at: date,
    updated_at: date,
  } as FinancialEntry
}

const PERIOD = { from: '2026-04-01', to: '2026-04-30' }

const ACCOUNTS: ChartAccountV2[] = [
  makeAccount('a1', '4.1.1', 'REVENUE'),           // Receita Bruta
  makeAccount('a2', '4.2.1', 'REVENUE'),           // Deduções
  makeAccount('a3', '5.1.1', 'EXPENSE'),           // CPV
  makeAccount('a4', '5.3.1.1', 'EXPENSE'),         // Despesas Comerciais
  makeAccount('a5', '5.3.2.1', 'EXPENSE'),         // Despesas Administrativas
  makeAccount('a6', '5.3.3.1', 'EXPENSE'),         // Despesas Financeiras
  makeAccount('a7', '5.6.1', 'EXPENSE'),           // Despesas Não Operacionais
  makeAccount('a8', '4.4.1', 'REVENUE'),           // Receitas Não Operacionais
  makeAccount('a9', '5.8.1', 'EXPENSE'),           // Impostos (IRPJ/CSLL)
  makeAccount('a10', '5.3.2.5', 'EXPENSE', 'depreciation'), // D&A
]

// ──────────────────────────────────────────────────────────────────────
// Cenário 1 — DRE completa com todos os grupos
// ──────────────────────────────────────────────────────────────────────

describe('calculateIFRSDRE', () => {
  it('cenário 1: cascata DRE completa', () => {
    const entries: FinancialEntry[] = [
      makeEntry('e1', 'a1', 100_000),   // receita bruta
      makeEntry('e2', 'a2', 5_000),    // deduções
      makeEntry('e3', 'a3', 40_000),   // CPV
      makeEntry('e4', 'a4', 8_000),    // comercial
      makeEntry('e5', 'a5', 12_000),   // administrativo
      makeEntry('e6', 'a6', 3_000),    // financeiro
      makeEntry('e7', 'a7', 2_000),    // não operacional despesa
      makeEntry('e8', 'a8', 1_000),    // não operacional receita
      makeEntry('e9', 'a9', 6_000),    // impostos
      makeEntry('e10', 'a10', 4_000),  // D&A
    ]

    const dre = calculateIFRSDRE(entries, ACCOUNTS, PERIOD)

    expect(dre.receitaBruta.toNumber()).toBe(100_000)
    expect(dre.deducoes.toNumber()).toBe(5_000)
    expect(dre.receitaLiquida.toNumber()).toBe(95_000)
    expect(dre.cpv.toNumber()).toBe(40_000)
    expect(dre.lucroBruto.toNumber()).toBe(55_000)

    // EBIT = 55.000 - (8k + 12k + 3k) = 55.000 - 23.000 = 32.000
    expect(dre.totalDespesasOperacionais.toNumber()).toBe(23_000)
    expect(dre.ebit.toNumber()).toBe(32_000)

    // EBITDA = EBIT + D&A = 32.000 + 4.000 = 36.000
    expect(dre.ebitda.toNumber()).toBe(36_000)

    // EBT = 32.000 - 2.000 + 1.000 = 31.000
    expect(dre.lucroAntesImpostos.toNumber()).toBe(31_000)
    expect(dre.lucroLiquido.toNumber()).toBe(25_000)

    expect(dre.totalEntries).toBe(10)
  })

  // ──────────────────────────────────────────────────────────────────
  // Cenário 2 — Receita zero (margens devem ser 0, sem divisão por zero)
  // ──────────────────────────────────────────────────────────────────

  it('cenário 2: sem receita — margens retornam 0 sem exceção', () => {
    const dre = calculateIFRSDRE([], ACCOUNTS, PERIOD)

    expect(dre.receitaBruta.toNumber()).toBe(0)
    expect(dre.margemBruta.toNumber()).toBe(0)
    expect(dre.margemEBITDA.toNumber()).toBe(0)
    expect(dre.margemLiquida.toNumber()).toBe(0)
    expect(dre.totalEntries).toBe(0)
  })

  // ──────────────────────────────────────────────────────────────────
  // Cenário 3 — Lançamentos cancelados são ignorados
  // ──────────────────────────────────────────────────────────────────

  it('cenário 3: lançamentos cancelados ignorados', () => {
    const entries: FinancialEntry[] = [
      makeEntry('e1', 'a1', 100_000),
      { ...makeEntry('e2', 'a1', 50_000), status: 'cancelled' },
    ]

    const dre = calculateIFRSDRE(entries, ACCOUNTS, PERIOD)
    expect(dre.receitaBruta.toNumber()).toBe(100_000)
  })

  // ──────────────────────────────────────────────────────────────────
  // Cenário 4 — Lançamentos fora do período são ignorados
  // ──────────────────────────────────────────────────────────────────

  it('cenário 4: lançamentos fora do período ignorados', () => {
    const entries: FinancialEntry[] = [
      makeEntry('e1', 'a1', 100_000, '2026-04-15'),  // dentro
      makeEntry('e2', 'a1', 50_000, '2026-03-31'),   // fora (antes)
      makeEntry('e3', 'a1', 50_000, '2026-05-01'),   // fora (depois)
    ]

    const dre = calculateIFRSDRE(entries, ACCOUNTS, PERIOD)
    expect(dre.receitaBruta.toNumber()).toBe(100_000)
    expect(dre.totalEntries).toBe(1)
  })

  // ──────────────────────────────────────────────────────────────────
  // Cenário 5 — KPIs: margens calculadas corretamente
  // ──────────────────────────────────────────────────────────────────

  it('cenário 5: KPIs com margens percentuais corretas', () => {
    const entries: FinancialEntry[] = [
      makeEntry('e1', 'a1', 200_000),  // receita bruta
      makeEntry('e2', 'a3', 80_000),   // CPV → lucroBruto = 120k
      // sem deduções, sem outras despesas
    ]

    const dre = calculateIFRSDRE(entries, ACCOUNTS, PERIOD)

    // margemBruta = 120k / 200k * 100 = 60%
    expect(dre.margemBruta.toFixed(2)).toBe('60.00')
    // ebit = lucro bruto = 120k
    expect(dre.margemEBIT.toFixed(2)).toBe('60.00')
  })
})

// ──────────────────────────────────────────────────────────────────────
// calcIFRSKPIs
// ──────────────────────────────────────────────────────────────────────

describe('calcIFRSKPIs', () => {
  it('cenário 6: ROE e ROA calculados quando patrimônio/ativo informados', () => {
    const dre: IFRSDREResult = {
      receitaBruta: new Decimal(100_000),
      deducoes: new Decimal(0),
      receitaLiquida: new Decimal(100_000),
      cpv: new Decimal(0),
      lucroBruto: new Decimal(100_000),
      despesasComerciais: new Decimal(0),
      despesasAdministrativas: new Decimal(0),
      despesasFinanceiras: new Decimal(0),
      totalDespesasOperacionais: new Decimal(0),
      ebit: new Decimal(100_000),
      depreciacao: new Decimal(0),
      amortizacao: new Decimal(0),
      ebitda: new Decimal(100_000),
      despesasNaoOperacionais: new Decimal(0),
      receitasNaoOperacionais: new Decimal(0),
      lucroAntesImpostos: new Decimal(100_000),
      irpj: new Decimal(0),
      csll: new Decimal(0),
      totalImpostos: new Decimal(0),
      lucroLiquido: new Decimal(20_000),
      margemBruta: new Decimal(100),
      margemEBIT: new Decimal(100),
      margemEBITDA: new Decimal(100),
      margemLiquida: new Decimal(20),
      period: PERIOD,
      totalEntries: 1,
    }

    const kpis = calcIFRSKPIs(dre, {
      patrimonioLiquido: 200_000,
      ativoTotal: 400_000,
    })

    // ROE = 20k / 200k * 100 = 10%
    expect(kpis.roe?.toFixed(2)).toBe('10.00')
    // ROA = 20k / 400k * 100 = 5%
    expect(kpis.roa?.toFixed(2)).toBe('5.00')
  })

  it('cenário 7: crescimento calculado vs período anterior', () => {
    const makeDre = (receita: number, ebitdaVal: number): IFRSDREResult => ({
      receitaBruta: new Decimal(receita),
      deducoes: new Decimal(0),
      receitaLiquida: new Decimal(receita),
      cpv: new Decimal(0),
      lucroBruto: new Decimal(receita),
      despesasComerciais: new Decimal(0),
      despesasAdministrativas: new Decimal(0),
      despesasFinanceiras: new Decimal(0),
      totalDespesasOperacionais: new Decimal(0),
      ebit: new Decimal(ebitdaVal),
      depreciacao: new Decimal(0),
      amortizacao: new Decimal(0),
      ebitda: new Decimal(ebitdaVal),
      despesasNaoOperacionais: new Decimal(0),
      receitasNaoOperacionais: new Decimal(0),
      lucroAntesImpostos: new Decimal(ebitdaVal),
      irpj: new Decimal(0),
      csll: new Decimal(0),
      totalImpostos: new Decimal(0),
      lucroLiquido: new Decimal(ebitdaVal),
      margemBruta: new Decimal(100),
      margemEBIT: new Decimal(100),
      margemEBITDA: new Decimal(100),
      margemLiquida: new Decimal(100),
      period: PERIOD,
      totalEntries: 1,
    })

    const atual = makeDre(110_000, 22_000)
    const anterior = makeDre(100_000, 20_000)

    const kpis = calcIFRSKPIs(atual, { periodoAnterior: anterior })

    // crescimento receita = (110k - 100k) / 100k * 100 = 10%
    expect(kpis.crescimentoReceita?.toFixed(2)).toBe('10.00')
    // crescimento EBITDA = (22k - 20k) / 20k * 100 = 10%
    expect(kpis.crescimentoEBITDA?.toFixed(2)).toBe('10.00')
  })
})

// ──────────────────────────────────────────────────────────────────────
// validateAccountingEquation
// ──────────────────────────────────────────────────────────────────────

describe('validateAccountingEquation', () => {
  it('cenário 8: equação balanceada (A = P + PL)', () => {
    const accounts: ChartAccountV2[] = [
      { ...makeAccount('x1', '1.1', 'ASSET'), is_calculated: false },
      { ...makeAccount('x2', '2.1', 'LIABILITY'), is_calculated: false },
      { ...makeAccount('x3', '3.1', 'EQUITY'), is_calculated: false },
    ]

    const balances: Record<string, number> = { x1: 100_000, x2: 40_000, x3: 60_000 }

    const result = validateAccountingEquation(accounts, (a) => new Decimal(balances[a.id] ?? 0))

    expect(result.balanced).toBe(true)
    expect(result.assets.toNumber()).toBe(100_000)
    expect(result.liabilities.toNumber()).toBe(40_000)
    expect(result.equity.toNumber()).toBe(60_000)
    expect(result.delta.toNumber()).toBe(0)
  })

  it('cenário 9: equação desbalanceada detectada', () => {
    const accounts: ChartAccountV2[] = [
      { ...makeAccount('y1', '1.1', 'ASSET'), is_calculated: false },
      { ...makeAccount('y2', '2.1', 'LIABILITY'), is_calculated: false },
      { ...makeAccount('y3', '3.1', 'EQUITY'), is_calculated: false },
    ]

    const balances: Record<string, number> = { y1: 100_000, y2: 40_000, y3: 50_000 }

    const result = validateAccountingEquation(accounts, (a) => new Decimal(balances[a.id] ?? 0))

    expect(result.balanced).toBe(false)
    expect(result.delta.toNumber()).toBe(10_000)
  })
})
