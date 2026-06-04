-- ============================================================
-- Migration 008: Staging de lançamentos OFX pendentes de classificação
-- Permite importar extratos bancários sem conta contábil definida.
-- A classificação é feita posteriormente pelo responsável.
-- ============================================================

create table if not exists ofx_pending_entries (
  id               uuid        primary key default gen_random_uuid(),
  company_id       uuid        not null references companies(id) on delete cascade,

  -- Dados do extrato OFX
  fit_id           text        not null,           -- ID único da transação no banco
  ofx_type         text        not null check (ofx_type in ('DEBIT', 'CREDIT', 'OTHER')),
  amount           numeric(14,2) not null check (amount >= 0),
  transaction_date date        not null,
  name             text        not null default '',
  memo             text        not null default '',

  -- Classificação (preenchida pelo responsável)
  chart_account_id uuid        references chart_accounts(id),
  chart_account_v2_id uuid     references chart_accounts_v2(id),
  entry_type       text        check (entry_type in ('receivable', 'payable')),

  -- Controle
  status           text        not null default 'pending'
                               check (status in ('pending', 'imported', 'ignored')),
  imported_entry_id uuid       references financial_entries(id),
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Evita duplicar transação do mesmo banco
  unique (company_id, fit_id)
);

alter table ofx_pending_entries enable row level security;

drop policy if exists "users manage their ofx_pending_entries" on ofx_pending_entries;
create policy "users manage their ofx_pending_entries"
  on ofx_pending_entries for all
  using (company_id in (select id from companies where user_id = auth.uid()));

-- Índices para listagem eficiente
create index if not exists ofx_pending_entries_company_status
  on ofx_pending_entries (company_id, status);

create index if not exists ofx_pending_entries_date
  on ofx_pending_entries (company_id, transaction_date desc);

-- ============================================================
-- Regras de auto-classificação por favorecido/fornecedor
-- Quando o mesmo nome aparece, o app já sabe qual conta usar.
-- ============================================================

create table if not exists ofx_classification_rules (
  id                   uuid   primary key default gen_random_uuid(),
  company_id           uuid   not null references companies(id) on delete cascade,

  -- Padrão de nome (match exato, case-insensitive)
  payee_pattern        text   not null,

  -- Classificação memorizada
  chart_account_id     uuid   references chart_accounts(id),
  chart_account_v2_id  uuid   references chart_accounts_v2(id),
  entry_type           text   not null check (entry_type in ('receivable', 'payable')),

  -- Estatísticas de uso
  match_count          integer not null default 0,
  last_matched_at      timestamptz,

  created_at           timestamptz not null default now(),

  unique (company_id, payee_pattern)
);

alter table ofx_classification_rules enable row level security;

drop policy if exists "users manage their ofx_classification_rules" on ofx_classification_rules;
create policy "users manage their ofx_classification_rules"
  on ofx_classification_rules for all
  using (company_id in (select id from companies where user_id = auth.uid()));
