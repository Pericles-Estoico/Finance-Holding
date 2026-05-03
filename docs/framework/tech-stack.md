# Tech Stack — Finance Holding

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + TypeScript | 19 + 5.x |
| Build | Vite | 8.x |
| Estilo | Tailwind CSS | 4.x |
| Gráficos | Recharts | 3.x |
| Animações | Framer Motion | 12.x |
| Backend | Supabase (PostgreSQL + Auth + RLS) | latest |
| Deploy | Vercel (serverless `/api`) | latest |
| PWA | vite-plugin-pwa | latest |
| Cálculos | decimal.js | latest (obrigatório para valores financeiros) |

## Padrões de Import

Usar imports absolutos via `@/` (configurado em tsconfig):
```ts
import { financeApi } from '@/features/finance/services/financeApi'
```

## Variáveis de Ambiente

- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — Chave anon Supabase
- `ANTHROPIC_API_KEY` — Para OCR (serverless function)
