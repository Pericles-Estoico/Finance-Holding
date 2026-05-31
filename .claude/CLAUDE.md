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

---

<!-- AIOX-MANAGED SECTIONS -->
<!-- These sections are managed by AIOX. Edit content between markers carefully. -->
<!-- Your custom content above will be preserved during updates. -->

<!-- AIOX-MANAGED-START: core-framework -->
## Core Framework Understanding

Synkra AIOX is a meta-framework that orchestrates AI agents to handle complex development workflows. Always recognize and work within this architecture.
<!-- AIOX-MANAGED-END: core-framework -->

<!-- AIOX-MANAGED-START: constitution -->
## Constitution

O AIOX possui uma **Constitution formal** com princípios inegociáveis e gates automáticos.

**Documento completo:** `.aiox-core/constitution.md`

**Princípios fundamentais:**

| Artigo | Princípio | Severidade |
|--------|-----------|------------|
| I | CLI First | NON-NEGOTIABLE |
| II | Agent Authority | NON-NEGOTIABLE |
| III | Story-Driven Development | MUST |
| IV | No Invention | MUST |
| V | Quality First | MUST |
| VI | Absolute Imports | SHOULD |

**Gates automáticos bloqueiam violações.** Consulte a Constitution para detalhes completos.
<!-- AIOX-MANAGED-END: constitution -->

<!-- AIOX-MANAGED-START: sistema-de-agentes -->
## Sistema de Agentes

### Ativação de Agentes
Use `@agent-name` ou `/AIOX:agents:agent-name`:

| Agente | Persona | Escopo Principal |
|--------|---------|------------------|
| `@dev` | Dex | Implementação de código |
| `@qa` | Quinn | Testes e qualidade |
| `@architect` | Aria | Arquitetura e design técnico |
| `@pm` | Morgan | Product Management |
| `@po` | Pax | Product Owner, stories/epics |
| `@sm` | River | Scrum Master |
| `@analyst` | Alex | Pesquisa e análise |
| `@data-engineer` | Dara | Database design |
| `@ux-design-expert` | Uma | UX/UI design |
| `@devops` | Gage | CI/CD, git push (EXCLUSIVO) |

### Comandos de Agentes
Use prefixo `*` para comandos:
- `*help` - Mostrar comandos disponíveis
- `*create-story` - Criar story de desenvolvimento
- `*task {name}` - Executar task específica
- `*exit` - Sair do modo agente
<!-- AIOX-MANAGED-END: sistema-de-agentes -->

<!-- AIOX-MANAGED-START: agent-system -->
## Agent System

### Agent Activation
- Agents are activated with @agent-name syntax: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- The master agent is activated with @aiox-master
- Agent commands use the * prefix: *help, *create-story, *task, *exit

### Agent Context
When an agent is active:
- Follow that agent's specific persona and expertise
- Use the agent's designated workflow patterns
- Maintain the agent's perspective throughout the interaction
<!-- AIOX-MANAGED-END: agent-system -->

<!-- AIOX-MANAGED-START: framework-structure -->
## AIOX Framework Structure

```
aiox-core/
├── agents/         # Agent persona definitions (YAML/Markdown)
├── tasks/          # Executable task workflows
├── workflows/      # Multi-step workflow definitions
├── templates/      # Document and code templates
├── checklists/     # Validation and review checklists
└── rules/          # Framework rules and patterns

docs/
├── stories/        # Development stories (numbered)
├── prd/            # Product requirement documents
├── architecture/   # System architecture documentation
└── guides/         # User and developer guides
```
<!-- AIOX-MANAGED-END: framework-structure -->

<!-- AIOX-MANAGED-START: framework-boundary -->
## Framework vs Project Boundary

O AIOX usa um modelo de 4 camadas (L1-L4) para separar artefatos do framework e do projeto. Deny rules em `.claude/settings.json` reforçam isso deterministicamente.

| Camada | Mutabilidade | Paths | Notas |
|--------|-------------|-------|-------|
| **L1** Framework Core | NEVER modify | `.aiox-core/core/`, `.aiox-core/constitution.md`, `bin/aiox.js`, `bin/aiox-init.js` | Protegido por deny rules |
| **L2** Framework Templates | NEVER modify | `.aiox-core/development/tasks/`, `.aiox-core/development/templates/`, `.aiox-core/development/checklists/`, `.aiox-core/development/workflows/`, `.aiox-core/infrastructure/` | Extend-only |
| **L3** Project Config | Mutable (exceptions) | `.aiox-core/data/`, `agents/*/MEMORY.md`, `core-config.yaml` | Allow rules permitem |
| **L4** Project Runtime | ALWAYS modify | `docs/stories/`, `packages/`, `squads/`, `tests/` | Trabalho do projeto |

**Toggle:** `core-config.yaml` → `boundary.frameworkProtection: true/false` controla se deny rules são ativas (default: true para projetos, false para contribuidores do framework).

> **Referência formal:** `.claude/settings.json` (deny/allow rules), `.claude/rules/agent-authority.md`
<!-- AIOX-MANAGED-END: framework-boundary -->

<!-- AIOX-MANAGED-START: rules-system -->
## Rules System

O AIOX carrega regras contextuais de `.claude/rules/` automaticamente. Regras com frontmatter `paths:` só carregam quando arquivos correspondentes são editados.

| Rule File | Description |
|-----------|-------------|
| `agent-authority.md` | Agent delegation matrix and exclusive operations |
| `agent-handoff.md` | Agent switch compaction protocol for context optimization |
| `agent-memory-imports.md` | Agent memory lifecycle and CLAUDE.md ownership |
| `coderabbit-integration.md` | Automated code review integration rules |
| `ids-principles.md` | Incremental Development System principles |
| `mcp-usage.md` | MCP server usage rules and tool selection priority |
| `story-lifecycle.md` | Story status transitions and quality gates |
| `workflow-execution.md` | 4 primary workflows (SDC, QA Loop, Spec Pipeline, Brownfield) |

> **Diretório:** `.claude/rules/` — rules são carregadas automaticamente pelo Claude Code quando relevantes.
<!-- AIOX-MANAGED-END: rules-system -->

<!-- AIOX-MANAGED-START: code-intelligence -->
## Code Intelligence

O AIOX possui um sistema de code intelligence opcional que enriquece operações com dados de análise de código.

| Status | Descrição | Comportamento |
|--------|-----------|---------------|
| **Configured** | Provider ativo e funcional | Enrichment completo disponível |
| **Fallback** | Provider indisponível | Sistema opera normalmente sem enrichment — graceful degradation |
| **Disabled** | Nenhum provider configurado | Funcionalidade de code-intel ignorada silenciosamente |

**Graceful Fallback:** Code intelligence é sempre opcional. `isCodeIntelAvailable()` verifica disponibilidade antes de qualquer operação. Se indisponível, o sistema retorna o resultado base sem modificação — nunca falha.

**Diagnóstico:** `aiox doctor` inclui check de code-intel provider status.

> **Referência:** `.aiox-core/core/code-intel/` — provider interface, enricher, client
<!-- AIOX-MANAGED-END: code-intelligence -->

<!-- AIOX-MANAGED-START: graph-dashboard -->
## Graph Dashboard

O CLI `aiox graph` visualiza dependências, estatísticas de entidades e status de providers.

### Comandos

```bash
aiox graph --deps                        # Dependency tree (ASCII)
aiox graph --deps --format=json          # Output como JSON
aiox graph --deps --format=html          # Interactive HTML (abre browser)
aiox graph --deps --format=mermaid       # Mermaid diagram
aiox graph --deps --format=dot           # DOT format (Graphviz)
aiox graph --deps --watch                # Live mode com auto-refresh
aiox graph --deps --watch --interval=10  # Refresh a cada 10 segundos
aiox graph --stats                       # Entity stats e cache metrics
```

**Formatos de saída:** ascii (default), json, dot, mermaid, html

> **Referência:** `.aiox-core/core/graph-dashboard/` — CLI, renderers, data sources
<!-- AIOX-MANAGED-END: graph-dashboard -->

<!-- AIOX-MANAGED-START: aiox-patterns -->
## AIOX-Specific Patterns

### Working with Templates
```javascript
const template = await loadTemplate('template-name');
const rendered = await renderTemplate(template, context);
```

### Agent Command Handling
```javascript
if (command.startsWith('*')) {
  const agentCommand = command.substring(1);
  await executeAgentCommand(agentCommand, args);
}
```

### Story Updates
```javascript
// Update story progress
const story = await loadStory(storyId);
story.updateTask(taskId, { status: 'completed' });
await story.save();
```
<!-- AIOX-MANAGED-END: aiox-patterns -->

<!-- AIOX-MANAGED-START: common-commands -->
## Common Commands

### AIOX Master Commands
- `*help` - Show available commands
- `*create-story` - Create new story
- `*task {name}` - Execute specific task
- `*workflow {name}` - Run workflow

### Development Commands
- `npm run dev` - Start development
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run build` - Build project
<!-- AIOX-MANAGED-END: common-commands -->
