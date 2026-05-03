# Epic 4 — Balanço Patrimonial Completo

**ID:** EPIC-4  
**Status:** Planejado  
**Prioridade:** 🟡 Médio  
**Dependência:** Epic 1 (Plano Corporativo com 5 classes), Epic 2 (KPIs)  
**Agente responsável:** @dev  

---

## Objetivo

Implementar a tela de Balanço Patrimonial (BP) que exibe Ativo, Passivo e Patrimônio Líquido a partir do Plano de Contas Corporativo v2, com validação da equação contábil A = P + PL em tempo real.

---

## Stories

| Story | Título | Status |
|-------|--------|--------|
| [4.1](../stories/4.1.story.md) | Balanço Patrimonial — Tela e Cálculo IFRS | Draft |
| [4.2](../stories/4.2.story.md) | Indicadores de Liquidez e Solvência | Draft |

---

## Critérios de Conclusão do Epic

- [ ] Tela de Balanço Patrimonial exibindo Ativo, Passivo e PL por hierarquia
- [ ] Equação contábil A = P + PL validada com alert de desequilíbrio
- [ ] Indicadores de liquidez: corrente, seca, geral, endividamento
- [ ] Integrado ao FinanceCarousel como tela adicional
