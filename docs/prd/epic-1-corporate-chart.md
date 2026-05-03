# Epic 1 — Plano de Contas Corporativo IPO/M&A

**ID:** EPIC-1  
**Status:** Planejado  
**Prioridade:** 🔴 Crítico  
**Agente responsável:** @architect → @data-engineer → @dev  

---

## Objetivo

Migrar o plano de contas atual (básico, DRE-centrado) para o **Plano de Contas Corporativo de 5 classes** alinhado com IFRS/GAAP, permitindo gerar DRE, EBITDA, Fluxo de Caixa e Balanço Patrimonial com precisão para IPO/M&A.

## Referência

- [Plano de Contas Corporativo Completo](chart-of-accounts-corporate.md)
- [PRD Fase 2 Revisada](prd-phase2-corporate-chart.md)

---

## Contexto Técnico

**O que existe:**
- Tabela `chart_accounts`: hierarquia simples (code, name, parent_id, level, account_type, dre_group, ebitda_group, cash_flow_group)
- Sem classes contábeis (Ativo, Passivo, PL, Receitas, Custos)
- Sem suporte a Balanço Patrimonial
- Sem engine de cálculo IFRS

**O que precisa:**
- 5 classes contábeis completas com ~200 contas pré-definidas
- Engine de cálculo: Receita Líquida, Lucro Bruto, EBIT, EBITDA, Lucro Líquido
- Validação Ativos = Passivos + PL
- `decimal.js` para precisão numérica
- Seed do template corporativo

---

## Stories

| Story | Título | Status |
|-------|--------|--------|
| [1.1](../stories/1.1.story.md) | Migração do Schema — Plano de Contas Corporativo 5 Classes | Draft |
| [1.2](../stories/1.2.story.md) | Engine de Cálculo IFRS (DRE, EBITDA, Lucro Líquido) | Draft |
| [1.3](../stories/1.3.story.md) | UI — Árvore Hierárquica do Plano de Contas Corporativo | Draft |
| [1.4](../stories/1.4.story.md) | Seed Automático do Template Corporativo IPO/M&A | Draft |
| [1.5](../stories/1.5.story.md) | Validação Contábil — Ativos = Passivos + PL | Draft |

---

## Critérios de Conclusão do Epic

- [ ] Todas as 5 classes contábeis implementadas no banco
- [ ] Template corporativo com ~200 contas carregável via seed
- [ ] DRE recalculada com engine IFRS (Receita Líquida → Lucro Líquido)
- [ ] EBITDA = EBIT + D&A calculado automaticamente
- [ ] UI de gestão do plano de contas com árvore expansível
- [ ] Validação Ativos = Passivos + PL funcionando
- [ ] Testes unitários no engine de cálculo

---

## Decisões de Arquitetura

1. **Migração não-destrutiva**: criar nova tabela `chart_accounts_v2` e migrar gradualmente, mantendo `chart_accounts` original intacto (regra crítica: NÃO alterar tabelas existentes)
2. **`decimal.js`**: obrigatório em todos os cálculos financeiros
3. **Contas calculadas**: flag `is_calculated` para contas que são somas automáticas (Receita Líquida, Lucro Bruto, etc.)
4. **Hierarquia**: até 5 níveis (ex: `5.3.1.1.1`)
