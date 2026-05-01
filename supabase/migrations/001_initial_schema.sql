-- ============================================================
-- Finance Master — Schema Inicial
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- TABELA: companies (Empresas / CNPJs)
-- ============================================================
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  cnpj        text not null,
  tax_regime  text not null check (tax_regime in ('simples_nacional', 'lucro_presumido')),
  logo_url    text,
  created_at  timestamptz not null default now(),
  unique (user_id, cnpj)
);

-- RLS
alter table public.companies enable row level security;
create policy "companies: owner only" on public.companies
  using (auth.uid() = user_id);

-- ============================================================
-- TABELA: chart_of_accounts (Plano de Contas)
-- ============================================================
create table if not exists public.chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        text not null check (type in (
    'ativo', 'passivo', 'receita', 'cmv', 'despesa_operacional', 'imposto'
  )),
  parent_id   uuid references public.chart_of_accounts(id) on delete set null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (company_id, code)
);

-- RLS via JOIN com companies
alter table public.chart_of_accounts enable row level security;
create policy "chart_of_accounts: owner only" on public.chart_of_accounts
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- TABELA: transactions (Transações)
-- ============================================================
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  account_id      uuid not null references public.chart_of_accounts(id) on delete restrict,
  type            text not null check (type in ('receita', 'despesa')),
  amount_cents    bigint not null check (amount_cents >= 0),
  description     text not null,
  date            date not null,
  channel         text check (channel in (
    'amazon', 'shopify', 'varejo_fisico', 'b2b', 'mercado_livre', 'outros'
  )),
  drive_file_url  text,
  drive_file_id   text,
  is_simulation   boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Índices de performance
create index if not exists idx_transactions_company_date
  on public.transactions (company_id, date);
create index if not exists idx_transactions_channel
  on public.transactions (channel);
create index if not exists idx_transactions_simulation
  on public.transactions (is_simulation);

-- RLS
alter table public.transactions enable row level security;
create policy "transactions: owner only" on public.transactions
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- TABELA: benchmarks (Métricas de Mercado)
-- ============================================================
create table if not exists public.benchmarks (
  id           uuid primary key default gen_random_uuid(),
  metric_key   text not null unique,
  metric_name  text not null,
  min_value    numeric(10,4) not null,
  max_value    numeric(10,4) not null,
  sector       text not null default 'manufatura_varejo',
  year         int  not null default 2025,
  source       text not null,
  created_at   timestamptz not null default now()
);

-- Benchmarks são públicos (somente leitura para todos os autenticados)
alter table public.benchmarks enable row level security;
create policy "benchmarks: read for authenticated" on public.benchmarks
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- SEED: Benchmarks padrão do setor (PRD §5, fontes [1][2])
-- ============================================================
insert into public.benchmarks (metric_key, metric_name, min_value, max_value, sector, year, source)
values
  ('margem_bruta',    'Margem Bruta',    55.00, 70.00, 'manufatura_varejo', 2025,
   'TrueProfit — 2026 Ecommerce Profit Margins'),
  ('margem_liquida',  'Margem Líquida',  18.00, 26.00, 'manufatura_varejo', 2025,
   'Robert Half — 2025 Panorama Setorial Consumo e Varejo'),
  ('aov_variacao',    'Variação AOV',     5.00, 15.00, 'manufatura_varejo', 2025,
   'BigCommerce — Ecommerce Metrics 2026'),
  ('conversion_rate', 'Taxa de Conversão', 2.50,  4.50, 'manufatura_varejo', 2025,
   'BigCommerce — Ecommerce Metrics 2026'),
  ('crr',             'Customer Retention Rate', 25.00, 45.00, 'manufatura_varejo', 2025,
   'BigCommerce — Ecommerce Metrics 2026')
on conflict (metric_key) do nothing;
