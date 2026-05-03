import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/** Converte centavos (inteiro) para Decimal */
export function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).dividedBy(100)
}

/** Converte valor decimal para centavos (inteiro) */
export function decimalToCents(value: Decimal | number | string): number {
  return new Decimal(value).times(100).toDecimalPlaces(0).toNumber()
}

/** Formata centavos para BRL: R$ 1.250,00 */
export function formatBRL(cents: number): string {
  return centsToDecimal(cents).toNumber().toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata percentual: 25,88% */
export function formatPercent(value: number): string {
  return new Decimal(value).toDecimalPlaces(2).toNumber().toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '%'
}

/** Soma um array de centavos sem erro de ponto flutuante */
export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => new Decimal(acc).plus(v).toNumber(), 0)
}

/** Calcula percentual: (part / total) * 100, retorna 0 se total = 0 */
export function calcPercent(part: number, total: number): number {
  if (total === 0) return 0
  return new Decimal(part).dividedBy(total).times(100).toDecimalPlaces(2).toNumber()
}

/** Formata valor decimal (não centavos) para BRL: R$ 1.250,00 */
export function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
