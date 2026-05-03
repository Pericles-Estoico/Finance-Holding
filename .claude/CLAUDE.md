# CLAUDE.md — Finance Holding

Este arquivo configura o comportamento do Claude Code para o projeto **Finance Holding** — plataforma SaaS de gestão financeira executiva para confecções e marketplaces.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilo | Tailwind CSS 4 |
| Gráficos | Recharts 3 |
| Animações | Framer Motion 12 |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel (serverless functions em `/api`) |
| PWA | vite-plugin-pwa |

---

## Arquitetura do Projeto

```
Finance-Holding/
├── src/
│   ├── pages/              # Páginas da aplicação (uma por rota)
│   ├── features/           # Módulos por domínio
│   │   └── finance/        # Módulo financeiro executivo
│   │       ├── components/ # Componentes visuais
│   │       ├── services/   # Cálculos e API (NUNCA dentro de componentes)
│   │       ├── types/      # Tipos TypeScript
│   │       └── data/       # Mock data
│   ├── components/         # Componentes compartilhados
│   │   └── layout/         # AppLayout, navegação
│   ├── contexts/           # React Context (Auth, Company, Simulation)
│   ├── lib/                # Utilitários (supabase, currency, dre, cashflow)
│   └── hooks/              # Custom hooks
├── api/                    # Serverless functions Vercel (drive-import, OCR)
├── supabase/
│   └── migrations/         # SQL migrations (001–004)
└── .aiox-core/             # Framework AIOX
```

---

## Módulos Ativos

### Finance Executivo (`/finance`)
- **FinanceCarousel** — navegação ←→ entre 4 telas (ArrowLeft/ArrowRight + dots + localStorage)
- **FinanceDashboard** — 20 KPIs + gráficos (Recharts)
- **DreScreen** — DRE por competência com drill-down
- **EbitdaScreen** — EBITDA bridge (reconciliação com Lucro Líquido)
- **CashFlowScreen** — fluxo projetado diário (due_date / paid_or_received_date)
- **FinancialEntriesPage** — CRUD de contas a pagar/receber com parcelamento e recorrência
- **ChartAccountsManager** — Plano de Contas com seed automático

### Drive Import (`/importar`)
- OCR via Anthropic API (Claude) + Google Drive folder
- Classificação automática de lançamentos

---

## Regras Críticas do Domínio

1. **DRE usa `competence_date`** — NUNCA `due_date` para calcular DRE
2. **Fluxo de Caixa usa `due_date` (previsto) e `paid_or_received_date` (realizado)**
3. **EBITDA exclui**: juros, D&A, impostos sobre lucro, investimentos, sócios
4. **Plano de Contas é a fonte da verdade** — lançamentos NÃO classificam diretamente em linha de DRE
5. **Cálculos financeiros NUNCA dentro de componentes visuais** — apenas em `services/`
6. **Lançamentos cancelados NÃO entram em nenhum cálculo**
7. **NÃO alterar tabelas existentes**: `companies`, `chart_of_accounts`, `transactions`

---

## Tabelas Supabase

| Tabela | Domínio |
|--------|---------|
| `companies` | Multi-empresa (existente) |
| `chart_of_accounts` | Plano de contas legado (existente) |
| `transactions` | Transações legado (existente) |
| `chart_accounts` | Plano de contas financeiro executivo (migration 004) |
| `financial_entries` | Lançamentos financeiros (migration 004) |
| `bank_accounts` | Contas bancárias (migration 004) |
| `cost_centers` | Centros de custo (migration 004) |
| `drive_import_configs` | Config de pasta Drive |
| `drive_processed_files` | Dedup OCR |
| `pending_classifications` | Fila de classificação manual |

---

## Ambiente e Deploy

- **Produção**: financedre.com.br (Vercel auto-deploy via push para `main`)
- **Supabase Project**: `tkvlzjvaazhjbxwsnywc`
- **Migration pendente**: `supabase/migrations/004_financial_module.sql`

---

## Framework AIOX

Este projeto usa **AIOX-Core** como framework de orquestração de IA.

- Constitution: `.aiox-core/constitution.md`
- Config do projeto: `.aiox-core/local-config.yaml`
- Agentes disponíveis em `.claude/agents/`

**Agentes recomendados para este projeto:**
- `aiox-dev` — desenvolvimento de features
- `aiox-architect` — decisões de arquitetura
- `aiox-analyst` — análise de dados financeiros
- `db-sage` — modelagem de banco de dados

---

## Idioma

Responder sempre em **português brasileiro**. Comentários de código e commits em português.

<!-- PROJECT-OWNED: Customizado para Finance-Holding -->
