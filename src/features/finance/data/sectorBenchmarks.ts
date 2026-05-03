// Benchmarks do setor confecção/varejo multicanal (fonte: SEBRAE + Abravest 2024)
export interface Benchmark {
  label: string
  target: number   // valor ideal (%)
  unit: '%' | 'x'
  description: string
  greenThreshold: number   // >= este valor = verde
  yellowThreshold: number  // >= este valor = amarelo, abaixo = vermelho
}

export const SECTOR_BENCHMARKS: Record<string, Benchmark> = {
  margemBruta: {
    label: 'Margem Bruta',
    target: 55,
    unit: '%',
    description: 'Lucro Bruto / Receita Líquida',
    greenThreshold: 55,
    yellowThreshold: 40,
  },
  margemOperacional: {
    label: 'Margem Operacional (EBIT)',
    target: 15,
    unit: '%',
    description: 'EBIT / Receita Líquida',
    greenThreshold: 15,
    yellowThreshold: 8,
  },
  margemEBITDA: {
    label: 'Margem EBITDA',
    target: 20,
    unit: '%',
    description: 'EBITDA / Receita Líquida',
    greenThreshold: 20,
    yellowThreshold: 12,
  },
  margemLiquida: {
    label: 'Margem Líquida',
    target: 18,
    unit: '%',
    description: 'Lucro Líquido / Receita Líquida',
    greenThreshold: 18,
    yellowThreshold: 8,
  },
  roe: {
    label: 'ROE',
    target: 15,
    unit: '%',
    description: 'Lucro Líquido / Patrimônio Líquido',
    greenThreshold: 15,
    yellowThreshold: 8,
  },
  roa: {
    label: 'ROA',
    target: 10,
    unit: '%',
    description: 'Lucro Líquido / Ativo Total',
    greenThreshold: 10,
    yellowThreshold: 5,
  },
  crescimentoReceita: {
    label: 'Crescimento Receita YoY',
    target: 20,
    unit: '%',
    description: 'Variação % da Receita Líquida vs período anterior',
    greenThreshold: 20,
    yellowThreshold: 5,
  },
  crescimentoEBITDA: {
    label: 'Crescimento EBITDA YoY',
    target: 25,
    unit: '%',
    description: 'Variação % do EBITDA vs período anterior',
    greenThreshold: 25,
    yellowThreshold: 5,
  },
}

export type BenchmarkStatus = 'green' | 'yellow' | 'red' | 'neutral'

export function getBenchmarkStatus(
  value: number | null,
  benchmark: Benchmark
): BenchmarkStatus {
  if (value === null) return 'neutral'
  if (value >= benchmark.greenThreshold) return 'green'
  if (value >= benchmark.yellowThreshold) return 'yellow'
  return 'red'
}
