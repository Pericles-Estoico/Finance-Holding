# SYSTEM_KNOWLEDGE.md
> Documento vivo de conhecimento do sistema Finance-Holding.
> Atualizado em: 2026-07-06 (AccountCombobox, is_forecast, FluxoCaixaPage, contas 5.7–5.11, 8.6, 5.2.1–5.2.6)
> **Objetivo:** preservar decisões técnicas, bugs corrigidos e padrões estabelecidos para evitar regressões.

---

## 1. Visão Geral da Arquitetura

### Stack
- **Frontend:** React + TypeScript + Vite, hospedado no Vercel
- **Backend/DB:** Supabase (PostgreSQL)
- **URL produção:** `financedre.com.br`
- **Repositório:** `Pericles-Estoico/Finance-Holding` (GitHub)

### Três Sistemas de Contas (estado atual — 2026-07-03)

O projeto tem **três tabelas de plano de contas** que coexistem:

| Tabela | Códigos | Quem usa | Campo vínculo em `transactions` |
|--------|---------|----------|--------------------------------|
| `chart_of_accounts` | Legado (Amazon/Shopee/B2B) | ninguém (depreciado) | `account_id` (legado, não usar) |
| `chart_accounts` | 1–11 grupos gerenciais | Transações, Lançamentos, Importar | `chart_account_id` ← **campo padrão atual** |
| `chart_accounts_v2` | IFRS (3.x.x / 4.x / 5.x) | OFX ImportWizard (legado) | `chart_account_v2_id` (nullable) |

> **REGRA ATUAL:** Toda nova transação deve salvar em `chart_account_id` (tabela `chart_accounts`). O campo `account_id` (legado) e `chart_account_v2_id` existem apenas por compatibilidade com dados antigos.

> **CRÍTICO:** `chart_account_v2_id` em `transactions` é `null` para a maioria dos registros. O sistema deve funcionar mesmo com esse campo nulo — fallback por `type` garante isso.

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
- Assinatura atual: `calculateIFRSDRE(entries, v2Accounts, period, unifiedAccounts?)`
- `unifiedAccounts` é o plano `chart_accounts` (1–11 grupos) — passado por `DreScreen`, `FinanceDashboard`, `EbitdaScreen`
- **Hierarquia de classificação** (por entrada):
  1. `chart_account_v2_id` → classifica pelo plano IFRS (account_type / account_code)
  2. `chart_account_id` + `dre_group` → classifica pelo plano unificado (1–11) **← novo**
  3. Fallback por `entry.type`: `receivable` → Receita Bruta, `payable` → Despesas Adm.
- **ATENÇÃO:** O filtro original exigia `e.chart_account_v2_id` não-nulo → causava zeros. **Removido.**
- **Mapeamento `dre_group` → bucket DRE:**

| `dre_group` | Bucket |
|-------------|--------|
| `gross_revenue` | Receita Bruta |
| `revenue_deductions` | Deduções |
| `cogs` | CMV |
| `commercial_expenses` | Despesas Comerciais |
| `administrative_expenses` / `operational_expenses` | Despesas Administrativas |
| `depreciation_amortization` | D&A |
| `financial_result` | Resultado Financeiro |
| `taxes_on_profit` | Impostos |

### 2.3 `calculateDRE()` — `src/features/finance/services/financeCalculations.ts`
- Engine legada do Finance Executivo
- Usado como fallback quando não há `chartAccountsV2`

---

## 3. Bridge: Transactions → FinancialEntry

O Finance Executivo usa `FinancialEntry[]` mas os dados reais estão em `transactions`.
A bridge está em `src/features/finance/services/financeApi.ts` → função `transactionsAsEntries()`.

```typescript
// Campos mapeados de Transaction → FinancialEntry:
// tx.amount_cents / 100               → entry.amount
// tx.type === 'receita'               → entry.type = 'receivable'
// tx.type === 'despesa'               → entry.type = 'payable'
// tx.date                             → entry.competence_date + due_date
// tx.chart_account_id ?? tx.account_id → entry.chart_account_id  ← preferência ao campo unificado
// tx.chart_account_v2_id              → entry.chart_account_v2_id
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
| `016_add_chart_account_id_to_transactions.sql` | Adiciona coluna `chart_account_id uuid` (FK para `chart_accounts`) em `transactions` — campo padrão para novos lançamentos |
| `017_add_chart_account_id_to_payee_rules.sql` | Adiciona `chart_account_id` em `payee_account_rules` e torna `account_id` nullable — suporta regras de payee com plano unificado |
| `018_add_new_accounts.sql` | Adiciona contas 5.7 Acertos Trabalhistas, 5.8 Processos Trabalhistas, 8.6 Venda de Ativos Imobilizados (level 2) e 5.2.1 Pericles, 5.2.2 Stella, 5.2.3 Kalev, 5.2.4 Felipe, 5.2.5 Doações, 5.2.6 Família (level 3, filhos de 5.2) |
| `019_add_benefit_accounts.sql` | Adiciona contas 5.9 Vale Refeição, 5.10 Premiação Funcionários, 5.11 Vale de Pagamentos — todas `administrative_expense`, `administrative_expenses`, `operating_outflow` |
| `020_add_is_forecast.sql` | Adiciona coluna `is_forecast BOOLEAN NOT NULL DEFAULT FALSE` em `financial_entries` — marca lançamentos de previsão/orçamento vs realizados |

> **Como aplicar nova migration:** criar arquivo `0NN_*.sql` e executar via `supabase db push` após `supabase link --project-ref tkvlzjvaazhjbxwsnywc`.

### CRÍTICO — Plano de contas unificado (estado atual)

| Tabela | Códigos | Quem usa | Campo salvo |
|--------|---------|----------|------------|
| `chart_accounts` | 1–11 gerenciais | Lançamentos, **Transações**, **Importar** | `chart_account_id` ← **padrão** |
| `chart_accounts_v2` | IFRS (3.x.x/4.x/5.x) | OFX ImportWizard (legado) | `chart_account_v2_id` |

A página **Importar** foi unificada em 2026-07-03: o seletor de conta agora sempre mostra `chart_accounts` (1–11) e salva em `chart_account_id`. O `CorporateAccountSelect` (v2 IFRS) foi removido do fluxo manual e de Drive.

Ao adicionar nova conta, **adicionar em `chart_accounts`** e também em `simulationData.ts`.

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

### Hierarquia de classificação no `ifrsEngine` — nunca inverter a ordem
```typescript
// 1º tenta chart_account_v2_id (IFRS)
if (!entry.chart_account_v2_id) {
  // 2º tenta chart_account_id + dre_group (plano unificado)
  const unified = entry.chart_account_id ? unifiedMap?.get(entry.chart_account_id) : undefined
  if (unified?.dre_group) {
    // classifica por switch(dre_group)
  } else {
    // 3º fallback por type
    if (entry.type === 'receivable') revenueEntries.push(entry)
    else if (entry.type === 'payable') adminEntries.push(entry)
  }
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
- [ ] Campo "Conta Contábil" em Lançamentos, Transações e Importar exibe combobox com busca (não `<select>` nativo)
- [ ] Toggle "Lançamento de Previsão" aparece no formulário de lançamentos (violeta quando ativo)
- [ ] Página Fluxo de Caixa (`/fluxo-caixa`) acessível pelo menu e exibe barras de realizados + previstas
- [ ] Vale Refeição (5.9), Premiação Funcionários (5.10) e Vale de Pagamentos (5.11) aparecem no formulário de lançamentos

---

## 12. Estrutura de Arquivos Críticos

```
src/
├── lib/
│   ├── dre.ts                          # calcDRE() — engine principal Dashboard
│   └── currency.ts                     # fmtBRL, formatBRL, sumCents
├── pages/
│   ├── DashboardPage.tsx               # Dashboard "/" com getRange() rolling windows
│   ├── FinancialEntriesPage.tsx        # Página de lançamentos c/ export
│   └── FluxoCaixaPage.tsx              # Fluxo de caixa semanal c/ previsões (/fluxo-caixa)
├── features/finance/
│   ├── components/
│   │   ├── FinanceDashboard.tsx        # Finance Executivo hub + dreForDisplay
│   │   ├── FinancialEntryForm.tsx      # Formulário c/ beneficiário pró-labore + toggle is_forecast
│   │   ├── FinancialEntriesTable.tsx   # Tabela c/ filtro conta + PDF/Excel/CSV
│   │   ├── AccountCombobox.tsx         # Combobox com busca em tempo real para conta contábil
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
└── migrations/                         # 001 a 020 — aplicar em ordem via supabase db push
```

> **CRÍTICO — simulationData.ts:** Toda vez que uma nova conta for adicionada via migration em `chart_accounts`, ela DEVE ser adicionada também em `simulationData.ts` (array `simulationChartAccounts`). Caso contrário, o Modo Simulação não exibirá a conta e o dropdown de Pró-labore não funcionará em simulação.

### Estado atual do simulationChartAccounts (sincronizado em 2026-07-06)

O array cobre **TODAS** as contas do `chart_accounts` real (grupos 1 a 11):

| Grupo | Contas |
|-------|--------|
| 1 Receitas | 1.1 a 1.6 (Shopee, ML, Shein, Loja Própria, Atacado, Outros Canais) |
| 2 Deduções | 2.1 a 2.6 (Cancelamentos, Devoluções, Descontos, Cupons, Impostos s/ Venda, Taxas Marketplace) |
| 3 CPV | 3.1 a 3.8 (Tecido, Aviamentos, Embalagem, Costura Int/Ext, Bordado, MO Direta, Perdas) |
| 4 Comerciais | 4.1 a 4.5 (Comissão, Frete Subsidiado, Tráfego Pago, Influenciadores, Fotos) |
| 5 Administrativas | 5.1 a 5.11 (Salários, Pró-labore [+subs], Contabilidade, Sistemas, Internet, Aluguel, Acertos Trabalhistas, Processos Trabalhistas, **Vale Refeição**, **Premiação Funcionários**, **Vale de Pagamentos**) |
| 5.2 Pró-labore | **5.2.1 Pericles, 5.2.2 Stella, 5.2.3 Kalev, 5.2.4 Felipe, 5.2.5 Doações, 5.2.6 Família** (level 3) |
| 6 Operacionais | 6.1 a 6.7 (Energia, Manutenção, EPIs, Limpeza, Combustível Emp, Combustível Terc, Despesas Viagem) |
| 7 Depreciação | 7.1 a 7.3 (Máquinas, Equipamentos, Amortização Sistemas) |
| 8 Financeiro | 8.1 a 8.6 (Juros Rec, Juros Pag, Tarifas, Multas, Encargos, **Venda de Ativos Imobilizados**) |
| 9 Impostos | 9.1 IRPJ, 9.2 CSLL |
| 10 Investimentos | 10.1 a 10.3 (Máquina, Equipamento, Reforma) |
| 11 Sócios | 11.1 Aporte, 11.2 Distribuição, 11.3 Retirada Extraordinária |

### Classificação das contas adicionadas (migrations 018–019)

| Código | Nome | dre_group | ebitda_group | cash_flow_group |
|--------|------|-----------|--------------|-----------------|
| 5.7 | Acertos Trabalhistas | administrative_expenses | excluded_from_ebitda | operating_outflow |
| 5.8 | Processos Trabalhistas | administrative_expenses | excluded_from_ebitda | operating_outflow |
| 8.6 | Venda de Ativos Imobilizados | financial_result | excluded_from_ebitda | financing_inflow |
| 5.2.1–5.2.6 | Pericles/Stella/Kalev/Felipe/Doações/Família | administrative_expenses | excluded_from_ebitda | owner_withdrawal |
| 5.9 | Vale Refeição | administrative_expenses | administrative_expenses | operating_outflow |
| 5.10 | Premiação Funcionários | administrative_expenses | administrative_expenses | operating_outflow |
| 5.11 | Vale de Pagamentos | administrative_expenses | administrative_expenses | operating_outflow |

> **Nota:** 5.7 e 5.8 são `excluded_from_ebitda` por serem itens não recorrentes (acertos e processos judiciais não fazem parte do EBITDA operacional). 5.9–5.11 são benefícios recorrentes, portanto incluídos no EBITDA (`administrative_expenses`).

---

## 15. Componente `AccountCombobox` — Busca em Tempo Real

**Arquivo:** `src/features/finance/components/AccountCombobox.tsx`

Substituiu todos os `<select>` nativos de "Conta Contábil" / "Conta do Plano" na aplicação.

### Onde é usado
| Arquivo | Campo substituído |
|---------|-----------------|
| `FinancialEntryForm.tsx` | Conta Contábil (formulário de lançamentos) |
| `TransacoesPage.tsx` | Conta do Plano (formulário de transações) |
| `ImportarPage.tsx` | Conta (OCR manual + loop OFX de classificações pendentes) |

### Props
```typescript
interface Props {
  accounts: ChartAccount[]
  value: string                    // ID da conta selecionada
  onChange: (id: string) => void
  required?: boolean               // ativa validação nativa (input oculto)
  disabled?: boolean               // estado desabilitado (opacity + cursor)
  placeholder?: string             // default: 'Selecione uma conta...'
}
```

### Funcionalidades
- Filtra em tempo real por código OU nome (case-insensitive)
- Navegação por teclado: ↑↓ navegar, Enter selecionar, Escape fechar
- Fecha ao clicar fora do componente
- Auto-foca input de busca ao abrir
- Scroll automático para item destacado
- Exibe código em monospace + nome; ✓ no item selecionado
- Contador de resultados filtrados no rodapé da busca

---

## 16. Campo `is_forecast` — Lançamentos de Previsão

**Migration:** `020_add_is_forecast.sql`
**Campo:** `financial_entries.is_forecast BOOLEAN NOT NULL DEFAULT FALSE`

### Regra
- `false` (padrão) → lançamento realizado ou a pagar/receber normalmente
- `true` → lançamento de previsão/orçamento (aparece no gráfico de projeção de fluxo de caixa com estilo diferenciado)

### Onde aparece
| Arquivo | Uso |
|---------|-----|
| `FinancialEntryForm.tsx` | Toggle "Lançamento de Previsão" (violet quando ativo) |
| `FluxoCaixaPage.tsx` | Barras de previsão (violeta/laranja) no gráfico |
| `financeApi.ts` | `getForecastEntries(companyId, startDate, endDate)` |
| `simulationData.ts` | `is_forecast: false` em todos os entries de simulação |
| `ofxApi.ts` | `is_forecast: false` no mapper de importação OFX |
| `FinancialEntriesPage.tsx` | `is_forecast: payload.is_forecast` no mapper de parcelas |

### API
```typescript
export async function getForecastEntries(
  companyId: string,
  startDate: string,   // YYYY-MM-DD
  endDate: string      // YYYY-MM-DD
): Promise<FinancialEntry[]>
// Retorna entradas com is_forecast=true, ordenadas por due_date ASC
```

---

## 17. Página Fluxo de Caixa — `/fluxo-caixa`

**Arquivo:** `src/pages/FluxoCaixaPage.tsx`
**Rota:** `/fluxo-caixa`
**Nav:** entre "Lançamentos" e "DRE" no `AppLayout.tsx`

### Funcionalidade
Gráfico de barras agrupadas mostrando o fluxo de caixa semanal (±4 semanas em torno de hoje):
- **Barras azul/vermelho:** entradas e saídas realizadas (`is_forecast = false`)
- **Barras violeta/laranja:** previsões de receita/despesa (`is_forecast = true`, `fillOpacity=0.7`)

### Estrutura de dados
```typescript
interface CashFlowChartRow {
  label: string           // "Sem 26", "Sem 27", ...
  receitas: number        // realizadas
  despesas: number        // realizadas
  receitasPrevistas: number
  despesasPrevistas: number
}
```

### Cores dos gráficos
| Série | Cor |
|-------|-----|
| Receitas realizadas | `#3B82F6` (blue-500) |
| Despesas realizadas | `#EF4444` (red-500) |
| Receitas previstas | `#A78BFA` (violet-400) |
| Despesas previstas | `#FDBA74` (orange-300) |

---

## 18. Template: Como Adicionar Novas Contas

Para adicionar novas contas sem precisar pedir manualmente, siga exatamente este fluxo:

### Passo 1 — Definir a classificação contábil

| Campo | Valores possíveis |
|-------|------------------|
| `account_type` | `gross_revenue`, `revenue_deduction`, `cogs`, `commercial_expense`, `administrative_expense`, `operational_expense`, `depreciation`, `amortization`, `financial_expense`, `financial_income`, `tax_on_profit`, `investment`, `equity` |
| `dre_group` | `gross_revenue`, `revenue_deductions`, `cogs`, `commercial_expenses`, `administrative_expenses`, `operational_expenses`, `depreciation_amortization`, `financial_result`, `taxes_on_profit`, `null` (fora do DRE) |
| `ebitda_group` | `net_revenue`, `cogs`, `commercial_expenses`, `administrative_expenses`, `operational_expenses`, `excluded_from_ebitda` |
| `cash_flow_group` | `operating_inflow`, `operating_outflow`, `financing_inflow`, `financing_outflow`, `investment_outflow`, `tax_outflow`, `owner_withdrawal`, `capital_injection` |

### Passo 2 — Criar migration `0NN_add_*.sql`

```sql
-- Migration 0NN: Adiciona [nome da conta]
INSERT INTO chart_accounts
  (company_id, code, name, level, account_type,
   dre_group, ebitda_group, cash_flow_group,
   affects_dre, affects_ebitda, affects_cash_flow, is_active)
VALUES
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   'X.Y', 'Nome da Conta', 2, 'account_type_aqui',
   'dre_group_aqui', 'ebitda_group_aqui', 'cash_flow_group_aqui',
   true, true, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
```

Para sub-contas (level 3), use INSERT...SELECT com parent_id via subquery:

```sql
INSERT INTO chart_accounts
  (company_id, code, name, level, parent_id, account_type,
   dre_group, ebitda_group, cash_flow_group,
   affects_dre, affects_ebitda, affects_cash_flow, is_active)
SELECT p.company_id, 'X.Y.Z', 'Nome Sub-conta', 3, p.id,
  'account_type', 'dre_group', 'ebitda_group', 'cash_flow_group',
  true, true, true, true
FROM chart_accounts p
WHERE p.company_id = 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51' AND p.code = 'X.Y'
ON CONFLICT (company_id, code) DO NOTHING;
```

### Passo 3 — Adicionar em `simulationData.ts`

Seguir o padrão existente (linha ~92). Nunca pular este passo.

```typescript
{ id: 'simulation-acc-X-Y', code: 'X.Y', name: 'Nome', parent_id: 'simulation-acc-X',
  level: 2, account_type: 'account_type', dre_group: 'dre_group',
  ebitda_group: 'ebitda_group', cash_flow_group: 'cash_flow_group',
  affects_dre: true, affects_ebitda: true, affects_cash_flow: true,
  is_active: true, company_id: SIMULATION_COMPANY_ID,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
```

### Passo 4 — Aplicar migration no Supabase

```bash
supabase link --project-ref tkvlzjvaazhjbxwsnywc
supabase db push
```

### Passo 5 — Atualizar SYSTEM_KNOWLEDGE.md

Adicionar a conta na tabela da seção 12 e atualizar a data de sincronização.

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
| 2026-07 | Tela Transações usava plano legado (`chart_of_accounts`), Lançamentos usava plano novo (`chart_accounts`) — dois planos diferentes na mesma sessão | `TransacoesPage` chamava `getAccounts()` → `chart_of_accounts`. Unificado para `getChartAccounts()` → `chart_accounts` (1–11). Migration 016 adicionou `chart_account_id` em `transactions`. Bridge `transactionsAsEntries` atualizada para preferir `chart_account_id`. Exports (PDF/CSV) atualizados para `ChartAccount`. | `TransacoesPage.tsx`, `financeApi.ts`, `csv.ts`, `pdf.ts`, migration 016 |
| 2026-07 | Página Importar atribuía conta em formato IFRS (`chart_account_v2_id`) no fluxo manual e Drive, exigindo segunda atribuição em Lançamentos | `ImportarPage` usava `CorporateAccountSelect` (v2 IFRS). Substituído por `<select>` com `chart_accounts` (1–11). `handleConfirm` salva `chart_account_id`. `handleClassify` envia `chart_account_id`. Backend `classify.ts` atualizado para aceitar `chart_account_id`. Migration 017 adicionou `chart_account_id` em `payee_account_rules`. | `ImportarPage.tsx`, `classify.ts`, `driveImport.ts`, migration 017 |
| 2026-07 | Finance Executivo DRE não usava `chart_account_id` para classificação — entradas com plano unificado (1–11) caíam todas em "Despesas Administrativas" | `ifrsEngine.calculateIFRSDRE` só entendia `chart_account_v2_id`. Adicionado 4º parâmetro `unifiedAccounts?: ChartAccount[]` com mapeamento de `dre_group` para buckets DRE. `DreScreen`, `FinanceDashboard` e `EbitdaScreen` agora passam `chartAccounts` ao engine. | `ifrsEngine.ts`, `DreScreen.tsx`, `FinanceDashboard.tsx`, `EbitdaScreen.tsx` |
| 2026-07 | Página Fluxo de Caixa existia mas nunca era acessível (sem rota, sem link no menu) | `FluxoCaixaPage.tsx` estava em `src/pages/` mas sem `lazy import` no `App.tsx` nem entrada em `navItems` no `AppLayout.tsx`. Corrigido adicionando rota `/fluxo-caixa` e link "Fluxo de Caixa" com ícone `TrendingUp`. | `App.tsx`, `AppLayout.tsx` |
| 2026-07 | `is_forecast` faltava nos mappers de OFX e de parcelas — erro TypeScript | `ofxApi.ts` e `FinancialEntriesPage.tsx` tinham mappers de `FinancialEntry` sem o campo obrigatório após migration 020. Corrigido adicionando `is_forecast: false` em cada mapper. | `ofxApi.ts`, `FinancialEntriesPage.tsx` |
| 2026-07 | `<select>` nativo ainda aparecia em TransacoesPage e ImportarPage mesmo após AccountCombobox criado | AccountCombobox foi criado e aplicado em `FinancialEntryForm`, mas `TransacoesPage` (campo "Conta do Plano") e `ImportarPage` (dois selects: OCR manual e loop OFX) ainda usavam `<select>` nativo. Corrigido em todos os três locais restantes. | `TransacoesPage.tsx`, `ImportarPage.tsx` |
