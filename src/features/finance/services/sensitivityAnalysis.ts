export interface SensitivityInputs {
  receitaVariation: number   // % variação de receita (-50 a +100)
  custosVariation: number    // % variação de CPV/CMV
  despesasVariation: number  // % variação de despesas operacionais
  impostosVariation: number  // % variação de impostos
}

export interface SensitivityResult {
  receitaBruta: number
  receitaLiquida: number
  lucroBruto: number
  ebitda: number
  ebit: number
  lucroLiquido: number
  margemBruta: number
  margemEbitda: number
  margemLiquida: number
}

export interface DREBase {
  receitaBruta: number
  receitaLiquida: number
  deducoes: number
  cmv: number
  lucroBruto: number
  despesasOperacionais: number
  ebitda: number
  depreciacao: number
  ebit: number
  resultadoFinanceiro: number
  impostos: number
  lucroLiquido: number
}

export function calcSensitivity(base: DREBase, inputs: SensitivityInputs): SensitivityResult {
  const factor = (pct: number) => 1 + pct / 100

  const receitaBruta = base.receitaBruta * factor(inputs.receitaVariation)
  const deducoes = base.deducoes * factor(inputs.receitaVariation)
  const receitaLiquida = receitaBruta - deducoes

  const cmv = base.cmv * factor(inputs.custosVariation)
  const lucroBruto = receitaLiquida - cmv

  const despesasOperacionais = base.despesasOperacionais * factor(inputs.despesasVariation)
  const ebitda = lucroBruto - despesasOperacionais

  const depreciacao = base.depreciacao
  const ebit = ebitda - depreciacao

  const impostos = base.impostos * factor(inputs.impostosVariation)
  const lucroLiquido = ebit + base.resultadoFinanceiro - impostos

  const margemBruta = receitaLiquida !== 0 ? (lucroBruto / receitaLiquida) * 100 : 0
  const margemEbitda = receitaLiquida !== 0 ? (ebitda / receitaLiquida) * 100 : 0
  const margemLiquida = receitaLiquida !== 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

  return {
    receitaBruta,
    receitaLiquida,
    lucroBruto,
    ebitda,
    ebit,
    lucroLiquido,
    margemBruta,
    margemEbitda,
    margemLiquida,
  }
}

export function buildScenarios(
  base: DREBase,
  sliders: SensitivityInputs
): { pessimista: SensitivityResult; base: SensitivityResult; otimista: SensitivityResult } {
  const baseResult = calcSensitivity(base, { receitaVariation: 0, custosVariation: 0, despesasVariation: 0, impostosVariation: 0 })

  const pessimista = calcSensitivity(base, {
    receitaVariation: -Math.abs(sliders.receitaVariation),
    custosVariation: Math.abs(sliders.custosVariation),
    despesasVariation: Math.abs(sliders.despesasVariation),
    impostosVariation: Math.abs(sliders.impostosVariation),
  })

  const otimista = calcSensitivity(base, {
    receitaVariation: Math.abs(sliders.receitaVariation),
    custosVariation: -Math.abs(sliders.custosVariation),
    despesasVariation: -Math.abs(sliders.despesasVariation),
    impostosVariation: -Math.abs(sliders.impostosVariation),
  })

  return { pessimista, base: baseResult, otimista }
}
