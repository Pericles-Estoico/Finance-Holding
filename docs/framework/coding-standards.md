# Coding Standards — Finance Holding

## Regras Críticas de Domínio

1. **Cálculos financeiros NUNCA em componentes** — somente em `services/`
2. **`decimal.js` obrigatório** para todos os valores monetários
3. **DRE usa `competence_date`** — NUNCA `due_date`
4. **Fluxo de Caixa usa `due_date` (previsto)** e `paid_or_received_date` (realizado)
5. **Lançamentos cancelados** (`status = 'cancelled'`) excluídos de TODOS os cálculos
6. **NÃO alterar tabelas existentes**: `companies`, `chart_of_accounts`, `transactions`

## TypeScript

- Sem `any` — sempre tipar explicitamente
- Interfaces para modelos de domínio em `types/`
- `Decimal` do `decimal.js` para campos monetários (não `number`)

## React

- Componentes funcionais + hooks
- Context para estado global (Auth, Company)
- Sem lógica de negócio em componentes — extrair para services/hooks

## Supabase / RLS

- Toda tabela nova deve ter RLS habilitado
- Policy padrão: `company_id in (select id from companies where user_id = auth.uid())`
- Migrations numeradas: `00N_nome.sql`

## Imports

```ts
// Correto — absoluto via @/
import { ifrsEngine } from '@/features/finance/services/ifrsEngine'

// Errado — relativo profundo
import { ifrsEngine } from '../../../services/ifrsEngine'
```

## Git / Commits

Conventional commits em português:
```
feat: implementar engine de cálculo IFRS [Story 1.2]
fix: corrigir cálculo de EBITDA com decimal.js
chore: adicionar migration 005 plano de contas v2
```
