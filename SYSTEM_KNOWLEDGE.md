# SYSTEM_KNOWLEDGE.md
> Documento vivo de conhecimento do sistema Finance-Holding.
> Atualizado em: 2026-07-03 (fix falso alerta Drive import)
> **Objetivo:** preservar decisões técnicas, bugs corrigidos e padrões estabelecidos para evitar regressões.

---

## 1. Visão Geral da Arquitetura

### Stack
- **Frontend:** React + TypeScript + Vite, hospedado no Vercel
- **Backend/DB:** Supabase (PostgreSQL)
- **URL produção:** `financedre.com.br`
- **Repositório:** `Pericles-Estoico/Finance-Holding` (GitHub)

### Dois Sistemas de Dados Paralelos

O projeto tem **dois sistemas de dados que coexistem** e NÃO devem ser confundidos:

| Sistema | Tabelas | Campo de vínculo | Engine de cálculo |
|---------|---------|-----------------|-------------------|
| **Legado** | `chart_of_accounts` + `transactions` | `account_id` | `calcDRE()` em `src/lib/dre.ts` |
| **V2 Corporativo** | `chart_accounts_v2` + `transactions` | `chart_account_v2_id` (nullable) | `calculateIFRSDRE()` em `ifrsEngine.ts` |
| **Finance Executivo** | `chart_accounts` + `financial_entries` | `chart_account_id` | `calculateDRE()` + `calculateIFRSDRE()` |

> **CRÍTICO:** `chart_account_v2_id` em `transactions` é `null` para todos os registros existentes (nunca foi backfillado). O sistema deve funcionar mesmo com esse campo nulo.

---

## 2. Três Engines de Cálculo DRE

### 2.1 `calcDRE()` — `src/lib/dre.ts`
- Usado pelo **Dashboard principal** (`/` path → `DashboardPage.tsx`)
- Recebe `Transaction[]`, `AccountCategory[]`, `ChartAccountV2[]`
- Fallback implementado: quando `chart_account_v2_id` é null e não há conta legada, classifica por `tx.type`:
  - `'receita'` → `byType.receita`
  - `'despesa'` → `byType.despesa_operacional`

### 2.2 `calculateIFRSDRE()` — `src/features/finance/services/ifrsEngine.ts`
- Usado pelo **Finance Executivo** (todas as 9 abas)
- Recebe `FinancialEntry[]`, `ChartAccountV2[]`, `{ from, to }`
- **ATENÇÃO:** O filtro original exigia `e.chart_account_v2_id` não-nulo → causava zeros. **Removido.**
- Fallback implementado: quando `chart_account_v2_id` é null, classifica por `entry.type`:
  - `'receivable'` → `revenueEntries`
  - `'payable'` → `adminEntries`

### 2.3 `calculateDRE()` — `src/features/finance/services/financeCalculations.ts`
- Engine legada do Finance Executivo
- Usado como fallback quando não há `chartAccountsV2`

---

## 3. Bridge: Transactions → FinancialEntry

O Finance Executivo usa `FinancialEntry[]` mas os dados reais estão em `transactions`.
A bridge está em `src/features/finance/services/financeApi.ts` → função `transactionsAsEntries()`.

```typescript
// Campos mapeados de Transaction → FinancialEntry:
// tx.amount_cents / 100  → entry.amount
// tx.type === 'receita'  → entry.type = 'receivable'
// tx.type === 'despesa'  → entry.type = 'payable'
// tx.date               → entry.competence_date + due_date
// tx.chart_account_v2_id → entry.chart_account_v2_id
```

> **Nunca remova ou altere a bridge sem testar todas as 9 abas do Finance Executivo.**

---

## 4. Filtros de Período — Janelas Deslizantes

**Arquivo:** `src/pages/DashboardPage.tsx` → função `getRange()`

### Problema Original (corrigido)
Os filtros apontavam para meses calendário correntes. Em julho/2026, com dados apenas em junho/2026, todos mostravam R$0.

### Solução Implementada (rolling windows)

| Filtro | Antes (quebrado) | Depois (correto) |
|--------|-----------------|-----------------|
| `hoje` | só o dia atual | últimos 7 dias corridos |
| `mes_atual` | 1º ao 31 do mês corrente | últimos 30 dias corridos |
| `trimestre` | Q calendário (ex: jul-set) | últimos 3 meses rolling |
| `ano_atual` | 1º jan ao 31 dez | mantido (calendário) |

### Regra Anti-Regressão
> **NUNCA voltar filtros de período para meses calendário fixos.** Os dados históricos estão em junho/2026 e o sistema deve sempre mostrar janelas deslizantes para garantir visibilidade dos dados.

```typescript
// CORRETO — rolling window
if (p === 'hoje') { const s=new Date(y,m,d-6); return { from: toIso(s), to: hojeStr } }
if (p === 'mes_atual') { const s=new Date(y,m,d-29); return { from: toIso(s), to: hojeStr } }

// ERRADO — calendário fixo (NUNCA faça isso)
// if (p === 'hoje') return { from: hojeStr, to: hojeStr }
// if (p === 'mes_atual') return { from: `${y}-${m+1}-01`, to: `${y}-${m+1}-31` }
```

---

## 5. Dashboard Principal vs Finance Executivo

São **sistemas completamente separados** com carregamento de dados independente.

### Dashboard Principal (`src/pages/DashboardPage.tsx`)
- Usa: `getTransactions()` → tabela `transactions`
- Usa: `getAccounts()` → tabela `chart_of_accounts`
- Usa: `getCorporateChart()` → tabela `chart_accounts_v2`
- Engine: `calcDRE()` de `src/lib/dre.ts`
- Empresa consolidada: **bloqueia** (mostra aviso)

### Finance Executivo (`src/features/finance/components/FinanceDashboard.tsx`)
- Usa: `getFinancialEntries()` → tabela `financial_entries`
- Usa: bridge `transactionsAsEntries()` → tabela `transactions`
- Usa: `getChartAccounts()` → tabela `chart_accounts`
- Usa: `getCorporateChart()` → tabela `chart_accounts_v2`
- Engine: `calculateIFRSDRE()` quando há `chartAccountsV2`, senão `calculateDRE()`

---

## 6. Componente `dreForDisplay` — Anti-Regressão

**Arquivo:** `src/features/finance/components/FinanceDashboard.tsx`

O JSX do FinanceDashboard deve SEMPRE usar `dreForDisplay.*` e NUNCA `dre.*` diretamente para os valores financeiros principais.

```typescript
const dreForDisplay = useMemo(() => {
  if (ifrsResult) {
    const n = (d: { toNumber(): number }) => d.toNumber()
    return {
      ...dre,
      receitaBruta: n(ifrsResult.receitaBruta),
      deducoes: n(ifrsResult.deducoes),
      receitaLiquida: n(ifrsResult.receitaLiquida),
      cmv: n(ifrsResult.cpv),
      lucroBruto: n(ifrsResult.lucroBruto),
      lucroLiquido: n(ifrsResult.lucroLiquido),
      margemBruta: n(ifrsResult.margemBruta),
      margemLiquida: n(ifrsResult.margemLiquida),
    }
  }
  return dre
}, [ifrsResult, dre])
```

> Se `ifrsResult` existir (há `chartAccountsV2`), os valores do IFRS têm precedência. Nunca renderize `dre.receitaBruta` diretamente no JSX.

---

## 7. Migrations Supabase

**Localização:** `supabase/migrations/`

| Migration | Descrição |
|-----------|-----------|
| `001_initial_schema.sql` | Schema inicial, tabela companies, users |
| `002_default_chart_of_accounts.sql` | Plano de contas padrão legado |
| `003_drive_import.sql` | Importação Google Drive |
| `004_financial_module.sql` | Módulo Finance Executivo (financial_entries, chart_accounts, bank_accounts, cost_centers) |
| `005_corporate_chart_v2.sql` | Tabela chart_accounts_v2 |
| `006_seed_corporate_chart.sql` | Seed plano IFRS corporativo |
| `007_seed_partner_compensation.sql` | Contas de pró-labore, INSS, IRRF dos sócios |
| `008_ofx_pending_entries.sql` | Importação OFX/bancário |
| `009_fix_transactions_v2_account.sql` | Adiciona coluna `chart_account_v2_id` em `transactions` (nullable) |
| `010_idempotency_constraints.sql` | Constraints de idempotência |
| `011_new_chart_of_accounts.sql` | Plano de contas gerencial simplificado |
| `012_add_fuel_accounts.sql` | Adiciona 3.8 Logística e Transporte (3.8.1 Combustível Empresa, 3.8.2 Combustível Terceiros, 3.8.3 Frete e Entrega, 3.8.4 Manutenção de Veículos). Legado: 6.5 e 6.6 |
| `013_add_fuel_to_chart_accounts.sql` | Adiciona 6.5 Combustível Empresa e 6.6 Combustível Terceiros em `chart_accounts` (tabela do formulário de lançamentos) |
| `014_add_travel_expenses.sql` | Adiciona 6.7 Despesas de Viagem em `chart_accounts` (tabela do formulário de lançamentos simples) |
| `015_add_travel_expenses_v2.sql` | Adiciona **3.8.5 Despesas de Viagem** em `chart_accounts_v2` (tabela IFRS usada pela página Importar via `CorporateAccountSelect.tsx`) |

> **Como aplicar nova migration:** criar arquivo `0NN_*.sql` e executar via `supabase db push` após `supabase link --project-ref tkvlzjvaazhjbxwsnywc`.

### CRÍTICO — Duas tabelas de contas: não confundir

| Tabela | Códigos | Componente que usa | Página |
|--------|---------|-------------------|--------|
| `chart_accounts` | 1 a 11 (simples, ex: 6.7) | `FinancialEntryForm.tsx` | Lançamentos |
| `chart_accounts_v2` | IFRS (ex: 3.8.5) | `CorporateAccountSelect.tsx` | Importar |

Ao adicionar nova conta, **adicionar nas duas tabelas** se necessário, além de `simulationData.ts`.

### Conta Pró-Labore
- **Código:** `5.2` (migration 004) / `5.3.2.1.6` (migration 007)
- **Nome:** `Pró-labore` / `Pró-labore de Sócios`
- **Tipo DRE:** `administrative_expense`
- **Grupo Fluxo de Caixa:** `owner_withdrawal`

---

## 8. Funcionalidade: Beneficiário no Pró-Labore

**Arquivo:** `src/features/finance/components/FinancialEntryForm.tsx`

Quando o usuário seleciona uma conta cujo `name` contém "pro-labore" (regex `/pro.?labore/i`), o campo "Contraparte / Fornecedor" muda automaticamente para um **dropdown "Beneficiário (familiar)"**.

Os valores são salvos na coluna `counterparty` de `financial_entries` — sem migration necessária.

**Opções atuais do dropdown:**
- Família
- Pericles
- Felipe
- Stella
- Kalev
- Doações

> Para personalizar os nomes: editar o array de `<option>` em `FinancialEntryForm.tsx` (linha ~106).

---

## 9. Exportação PDF e Excel

**Arquivo:** `src/features/finance/components/FinancialEntriesTable.tsx`

### Dependências
```json
"jspdf": "^4.2.1",
"jspdf-autotable": "instalado",
"xlsx": "instalado"
```

### Funções
| Função | Biblioteca | Saída |
|--------|-----------|-------|
| `exportPDF()` | jsPDF + autoTable | `.pdf` com tabela formatada, cabeçalho, data |
| `exportExcel()` | SheetJS (xlsx) | `.xlsx` com coluna Valor em formato moeda R$ |
| `exportCSV()` | nativo | `.csv` separado por `;` com BOM UTF-8 |

### Filtro por Conta
Novo filtro "Todas as contas" na barra de filtros permite **selecionar uma conta específica** antes de exportar. O nome da conta aparece no nome do arquivo exportado.

### Coluna Beneficiário
A coluna `counterparty` agora aparece como **"Beneficiário"** tanto na tabela visual quanto em todos os exports (PDF, Excel, CSV).

---

## 10. Padrões de Código Estabelecidos

### Nunca use `any` implícito nas engines de cálculo
```typescript
// CORRETO
const n = (d: { toNumber(): number }) => d.toNumber()

// ERRADO
const n = (d: any) => d.toNumber()
```

### Sempre use fallback por `type` quando conta é null
```typescript
// Em qualquer engine de classificação:
if (!entry.chart_account_v2_id) {
  if (entry.type === 'receivable') revenueEntries.push(entry)
  else if (entry.type === 'payable') adminEntries.push(entry)
  continue
}
```

### Formato de datas
- Sempre `YYYY-MM-DD` (ISO 8601)
- Para exibição: `new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')`
- O `T00:00:00` evita problema de timezone (-1 dia)

### Valores monetários
- Banco armazena em centavos (`amount_cents: number`) nas `transactions`
- Finance Executivo armazena em reais (`amount: number`) em `financial_entries`
- `calcDRE()` recebe `amount_cents`, `calculateIFRSDRE()` recebe `amount` em reais
- **NUNCA misture as unidades**

---

## 11. Checklist Anti-Regressão

Ao fazer qualquer alteração nos engines de cálculo, valide:

- [ ] Dashboard principal (`/`) mostra valores não-zero com filtro "Trimestre"
- [ ] Finance Executivo → DRE mostra valores
- [ ] Finance Executivo → EBITDA mostra valores
- [ ] Filtro "Este mês" no Dashboard mostra dados (rolling 30 dias)
- [ ] Filtro "Hoje" no Dashboard mostra dados (rolling 7 dias)
- [ ] Exportação PDF gera arquivo com dados
- [ ] Exportação Excel gera arquivo com dados
- [ ] Pró-labore no formulário mostra dropdown de beneficiário (Família, Pericles, Felipe, Stella, Kalev, Doações)
- [ ] Despesas de Viagem (6.7) aparece na lista de contas do formulário de Lançamentos
- [ ] Combustível Empresa (6.5) e Combustível Terceiros (6.6) aparecem no formulário de Lançamentos
- [ ] Modo Simulação: mesmas contas acima aparecem em `simulationData.ts`
- [ ] Página Importar: Despesas de Viagem (3.8.5) aparece no dropdown `CorporateAccountSelect` (tabela `chart_accounts_v2`)
- [ ] TypeScript sem erros: `npx tsc --noEmit`
- [ ] Lançamentos importados via Google Drive: coluna CONTA exibe o nome da conta v2 (não "-")
- [ ] Lançamentos importados via Google Drive: **nenhum** alerta vermelho de "sem conta contábil" para entradas com `chart_account_v2_id` preenchido

---

## 12. Estrutura de Arquivos Críticos

```
src/
├── lib/
│   ├── dre.ts                          # calcDRE() — engine principal Dashboard
│   └── currency.ts                     # fmtBRL, formatBRL, sumCents
├── pages/
│   ├── DashboardPage.tsx               # Dashboard "/" com getRange() rolling windows
│   └── FinancialEntriesPage.tsx        # Página de lançamentos c/ export
├── features/finance/
│   ├── components/
│   │   ├── FinanceDashboard.tsx        # Finance Executivo hub + dreForDisplay
│   │   ├── FinancialEntryForm.tsx      # Formulário c/ beneficiário pró-labore
│   │   ├── FinancialEntriesTable.tsx   # Tabela c/ filtro conta + PDF/Excel/CSV
│   │   ├── EbitdaScreen.tsx            # EBITDA com IFRS engine
│   │   └── DREScreen.tsx               # DRE detalhado
│   ├── services/
│   │   ├── ifrsEngine.ts               # calculateIFRSDRE() — IFRS cascade
│   │   ├── financeCalculations.ts      # calculateDRE(), calculateEBITDA()
│   │   ├── financeApi.ts               # API calls + transactionsAsEntries()
│   │   └── corporateChartApi.ts        # getCorporateChart() → chart_accounts_v2
│   ├── data/
│   │   └── simulationData.ts           # ⚠️ MANTER SINCRONIZADO com chart_accounts reais
│   └── types/
│       └── finance.types.ts            # FinancialEntry, ChartAccount, etc.
└── types/
    └── index.ts                        # Transaction, AccountCategory (legado)

supabase/
└── migrations/                         # 001 a 015 — aplicar em ordem via supabase db push
```

> **CRÍTICO — simulationData.ts:** Toda vez que uma nova conta for adicionada via migration em `chart_accounts`, ela DEVE ser adicionada também em `simulationData.ts` (array `simulationChartAccounts`). Caso contrário, o Modo Simulação não exibirá a conta e o dropdown de Pró-labore não funcionará em simulação.

### Estado atual do simulationChartAccounts (sincronizado em 2026-07-03)

O array cobre **TODAS** as contas do `chart_accounts` real (grupos 1 a 11):

| Grupo | Contas |
|-------|--------|
| 1 Receitas | 1.1 a 1.6 (Shopee, ML, Shein, Loja Própria, Atacado, Outros Canais) |
| 2 Deduções | 2.1 a 2.6 (Cancelamentos, Devoluções, Descontos, Cupons, Impostos s/ Venda, Taxas Marketplace) |
| 3 CPV | 3.1 a 3.8 (Tecido, Aviamentos, Embalagem, Costura Int/Ext, Bordado, MO Direta, Perdas) |
| 4 Comerciais | 4.1 a 4.5 (Comissão, Frete Subsidiado, Tráfego Pago, Influenciadores, Fotos) |
| 5 Administrativas | 5.1 a 5.6 (Salários, Pró-labore, Contabilidade, Sistemas, Internet, Aluguel) |
| 6 Operacionais | 6.1 a 6.7 (Energia, Manutenção, EPIs, Limpeza, Combustível Emp, Combustível Terc, Despesas Viagem) |
| 7 Depreciação | 7.1 a 7.3 (Máquinas, Equipamentos, Amortização Sistemas) |
| 8 Financeiro | 8.1 a 8.5 (Juros Rec, Juros Pag, Tarifas, Multas, Encargos) |
| 9 Impostos | 9.1 IRPJ, 9.2 CSLL |
| 10 Investimentos | 10.1 a 10.3 (Máquina, Equipamento, Reforma) |
| 11 Sócios | 11.1 Aporte, 11.2 Distribuição, 11.3 Retirada Extraordinária |

---

## 13. Deploy

| Serviço | Trigger | Tempo estimado |
|---------|---------|----------------|
| **Vercel** | Push para `main` no GitHub | ~1-2 min |
| **Supabase** | `supabase db push` (via CLI, project ref `tkvlzjvaazhjbxwsnywc`) | imediato |
| **GitHub** | `AIOX_ACTIVE_AGENT=devops git push origin main` (via @devops) | imediato |

> O `git push` requer o agente `@devops` ativo (AIOX Constitution Article II). Execute `AIOX_ACTIVE_AGENT=devops git push` ou ative `@devops` na sessão.

---

## 14. Histórico de Bugs Críticos Corrigidos

| Data | Bug | Causa Raiz | Arquivo(s) Corrigido(s) |
|------|-----|------------|------------------------|
| 2026-07 | Finance Executivo mostrava R$0 em todas abas | `ifrsEngine.ts` filtrava `e.chart_account_v2_id` — todos os registros bridgeados têm esse campo null | `ifrsEngine.ts` |
| 2026-07 | Dashboard R$0 com "Trimestre" | `getRange()` apontava Q3 (jul-set) mas dados estão em junho | `DashboardPage.tsx` |
| 2026-07 | Dashboard R$0 com "Este mês" e "Hoje" | Filtros usavam mês/dia calendário corrente, sem dados em julho | `DashboardPage.tsx` |
| 2026-07 | `dre.*` no JSX em vez de `dreForDisplay.*` | Refatoração incompleta do FinanceDashboard | `FinanceDashboard.tsx` |
| 2026-07 | `calcDRE` ignorava transações sem conta vinculada | Sem fallback por `tx.type` quando `account_id` e `chart_account_v2_id` ambos null | `dre.ts` |
| 2026-07 | Despesas de Viagem e Pró-labore não apareciam no formulário simples | `simulationData.ts` não tinha as contas 6.5, 6.6, 6.7 e 5.2 — Modo Simulação ignora Supabase e usa dados hardcoded | `simulationData.ts` |
| 2026-07 | Tela branca ao trocar de aba — só carregava com refresh | Service Worker (PWA) sem `skipWaiting`/`clientsClaim` → SW antigo mantinha chunks cacheados com hash desatualizado. Corrigido com `skipWaiting: true`, `clientsClaim: true` e `navigateFallback: 'index.html'` no `vite.config.ts` workbox | `vite.config.ts` |
| 2026-07 | Dropdown de beneficiário não aparecia ao selecionar Pró-labore | Regex `/pro.?labore/i` não combina com "Pró-labore" porque `ó` (U+00F3) ≠ `o`. Corrigido para `/pr[oó].?labore/i` | `FinancialEntryForm.tsx` |
| 2026-07 | Modo Simulação com apenas ~30% das contas reais disponíveis | `simulationChartAccounts` era subset parcial — faltavam 27 contas (grupos completos 1.3/1.5/1.6, 2.1-2.5, 3.2-3.8, 4.2/4.4/4.5, 5.3/5.5, 6.3/6.4, 7.2/7.3, 8.1/8.3-8.5, 9.2, 10 inteiro, 11 inteiro). Corrigido com sincronização total. | `simulationData.ts` |
| 2026-07 | Despesas de Viagem (3.8.5) não aparecia na página Importar | Conta faltava em `chart_accounts_v2` (tabela IFRS, códigos 3.x.x). As migrations 013 e 014 adicionaram na tabela errada (`chart_accounts`). A migration 015 corrigiu inserindo em `chart_accounts_v2`. | `supabase/migrations/015_add_travel_expenses_v2.sql` |
| 2026-07 | Falso alerta "Lançamentos sem conta contábil vinculada" e coluna CONTA mostrando "-" em entradas importadas via Google Drive | `FinancialDataHealthCheck` só verificava `chart_account_id` (tabela simples). Entradas do Drive usam `chart_account_v2_id` (tabela IFRS) e sempre têm `chart_account_id = null`. Solução: HealthCheck passou a aceitar `chartAccountsV2` prop e só alerta quando AMBOS os campos são nulos; `FinancialEntriesTable` exibe nome da conta v2 como fallback na coluna Conta; `FinancialEntriesPage` carrega e propaga `chartAccountsV2` para ambos os filhos. | `FinancialDataHealthCheck.tsx`, `FinancialEntriesTable.tsx`, `FinancialEntriesPage.tsx` |
