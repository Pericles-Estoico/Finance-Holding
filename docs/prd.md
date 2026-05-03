# PRD — Finance Holding: App Financeiro Master

**Versão:** 2.0  
**Status:** Ativo  
**Produto:** Finance Holding — SaaS de gestão financeira executiva para confecções e marketplaces multicanal  
**Domínio:** financedre.com.br  
**Stack:** React 19 + TypeScript + Vite + Tailwind + Supabase + Vercel  

---

## Visão do Produto

Plataforma financeira executiva que permite a empresas de manufatura e varejo multicanal gerar DRE, EBITDA e Fluxo de Caixa com precisão necessária para **IPO, M&A e apresentação a investidores**, alinhada com IFRS/GAAP.

## Objetivo de Negócio

Ser o sistema financeiro de referência para PMEs de confecção/varejo que querem:
1. Gestão financeira profissional com padrão corporativo
2. Relatórios prontos para apresentação a investidores
3. Suporte a multi-CNPJ consolidado
4. Conformidade IFRS 15/16 e GAAP

---

## Estado Atual (Implementado — Fase 1)

| Módulo | Status | Descrição |
|--------|--------|-----------|
| Autenticação | ✅ Feito | Supabase Auth + RLS |
| Multi-empresa | ✅ Feito | Tabela `companies` |
| Plano de Contas (básico) | ✅ Feito | `chart_accounts` com hierarquia simples |
| Lançamentos Financeiros | ✅ Feito | `financial_entries` (a pagar/receber) |
| DRE por Competência | ✅ Feito | Com drill-down |
| EBITDA Bridge | ✅ Feito | Reconciliação com Lucro Líquido |
| Fluxo de Caixa | ✅ Feito | Projeção diária |
| Drive Import + OCR | ✅ Feito | Anthropic API + Google Drive |
| Parcelamento e Recorrência | ✅ Feito | Em `financial_entries` |

---

## Roadmap de Epics

| Epic | Tema | Prioridade | Status |
|------|------|-----------|--------|
| [Epic 1](prd/epic-1-corporate-chart.md) | Plano de Contas Corporativo IPO/M&A | 🔴 Crítico | Planejado |
| [Epic 2](prd/epic-2-investor-reporting.md) | Relatórios e KPIs para Investidores | 🟠 Alto | Planejado |
| [Epic 3](prd/epic-3-ocr-corporate.md) | OCR com Mapeamento Corporativo | 🟡 Médio | Planejado |
| [Epic 4](prd/epic-4-balance-sheet.md) | Balanço Patrimonial Completo | 🟡 Médio | Planejado |

---

## Regras de Domínio Críticas

1. **DRE usa `competence_date`** — NUNCA `due_date`
2. **Fluxo de Caixa usa `due_date` (previsto) e `paid_or_received_date` (realizado)**
3. **EBITDA exclui**: juros, D&A, impostos sobre lucro, investimentos, sócios
4. **Plano de Contas é fonte da verdade** — lançamentos mapeiam para contas específicas
5. **Cálculos financeiros NUNCA dentro de componentes** — apenas em `services/`
6. **Lançamentos cancelados NÃO entram em nenhum cálculo**
7. **Precisão numérica**: usar `decimal.js` para evitar erros de ponto flutuante
8. **Validação contábil**: Ativos = Passivos + Patrimônio Líquido

---

## Referências

- [PRD Fase 2 - Plano Corporativo](prd/prd-phase2-corporate-chart.md)
- [Plano de Contas Corporativo IPO/M&A](prd/chart-of-accounts-corporate.md)
