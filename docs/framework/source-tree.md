# Source Tree — Finance Holding

```
src/
├── pages/                    # Uma página por rota
│   ├── DashboardPage.tsx
│   ├── FinanceExecutivePage.tsx  # Carrossel principal
│   ├── DrePage.tsx
│   ├── FluxoCaixaPage.tsx
│   ├── FinancialEntriesPage.tsx
│   ├── ImportarPage.tsx
│   ├── RelatoriosPage.tsx
│   ├── ConfiguracoesPage.tsx
│   ├── TransacoesPage.tsx
│   └── LoginPage.tsx
├── features/
│   └── finance/              # Módulo financeiro executivo
│       ├── components/       # Componentes visuais (SEM cálculos)
│       ├── services/         # Cálculos + API Supabase (NUNCA em componentes)
│       ├── hooks/            # Custom hooks
│       ├── types/            # TypeScript types
│       └── data/             # Mock data
├── components/
│   └── layout/               # AppLayout, navegação
├── contexts/                 # React Context (Auth, Company, Simulation)
├── lib/                      # Utilitários (supabase, currency, dre, cashflow)
└── hooks/                    # Custom hooks globais

api/                          # Serverless functions Vercel
supabase/migrations/          # SQL migrations (001–006+)
docs/
├── prd.md                    # PRD master
├── prd/                      # Epics e documentos de referência
├── stories/                  # Development stories (N.N.story.md)
├── architecture/             # Decisões de arquitetura
└── framework/                # Tech stack, coding standards, source tree
```

## Convenção de Arquivos

- Componentes: `PascalCase.tsx`
- Services/Hooks: `camelCase.ts`
- Stories: `{epic}.{story}.story.md` (ex: `1.1.story.md`)
- Migrations: `00N_nome_descritivo.sql`
