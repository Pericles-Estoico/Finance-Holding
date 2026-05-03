# Epic 2 — Relatórios e KPIs para Investidores

**ID:** EPIC-2  
**Status:** Planejado  
**Prioridade:** 🟠 Alto  
**Dependência:** Epic 1 (requer engine de cálculo IFRS)  
**Agente responsável:** @dev + @ux-design-expert  

---

## Objetivo

Implementar o módulo de relatórios executivos de 5 níveis e os KPIs corporativos para apresentação a investidores, com benchmarks do setor e análise de sensibilidade.

---

## Stories

| Story | Título | Status |
|-------|--------|--------|
| [2.1](../stories/2.1.story.md) | KPIs Corporativos (Margem Bruta, EBITDA, ROE, ROA) com Benchmarks | Draft |
| [2.2](../stories/2.2.story.md) | Relatório Nível 1 — Executive Summary (1 página) | Draft |
| [2.3](../stories/2.3.story.md) | Relatório Nível 2/3 — DRE Consolidada e por Canal | Draft |
| [2.4](../stories/2.4.story.md) | Análise de Sensibilidade (Cenários Otimista/Base/Pessimista) | Draft |
| [2.5](../stories/2.5.story.md) | Relatório Nível 5 — Fluxo de Caixa com Projeção 3-5 anos | Draft |

---

## KPIs Requeridos

| Indicador | Fórmula | Benchmark |
|-----------|---------|-----------|
| Margem Bruta | (Lucro Bruto / Receita Líquida) × 100 | 55-70% |
| Margem Operacional | (EBIT / Receita Líquida) × 100 | 15-25% |
| Margem EBITDA | (EBITDA / Receita Líquida) × 100 | 20-30% |
| Margem Líquida | (Lucro Líquido / Receita Líquida) × 100 | 18-26% |
| ROE | (Lucro Líquido / PL) × 100 | > 15% |
| ROA | (Lucro Líquido / Ativo Total) × 100 | > 10% |
| Crescimento Receita YoY | % | > 20% |
| Crescimento EBITDA YoY | % | > 25% |

---

## Critérios de Conclusão do Epic

- [ ] 8 KPIs corporativos calculados e exibidos com benchmarks
- [ ] Executive Summary exportável (Nível 1)
- [ ] DRE consolidada e por canal (Níveis 2 e 3)
- [ ] Análise de sensibilidade com 3 cenários (Nível 4)
- [ ] Fluxo de caixa projetado 3-5 anos (Nível 5)
- [ ] Comparação YoY automática
