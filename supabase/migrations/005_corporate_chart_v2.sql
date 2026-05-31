-- ============================================================
-- Migration 005: Plano de Contas Corporativo v2 (IPO/M&A)
-- Story 1.1 — EPIC-1
-- ============================================================
-- REGRA CRÍTICA: NÃO modifica tabelas existentes.
-- Cria chart_accounts_v2 e adiciona FK opcional em financial_entries.
--
-- Classes contábeis:
--   ASSET     (1) = Ativos — saldo normal: débito
--   LIABILITY (2) = Passivos — saldo normal: crédito
--   EQUITY    (3) = Patrimônio Líquido — saldo normal: crédito
--   REVENUE   (4) = Receitas — saldo normal: crédito
--   EXPENSE   (5) = Custos e Despesas — saldo normal: débito
-- ============================================================

-- ============================================================
-- TABELA: chart_accounts_v2
-- ============================================================
create table if not exists chart_accounts_v2 (
  id                uuid        primary key default gen_random_uuid(),

  -- Identificação da conta
  account_code      text        not null,
  account_name      text        not null,
  description       text,

  -- Classificação contábil IFRS/GAAP
  account_class     text        not null
    check (account_class in ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),

  -- Tipo específico dentro da classe (ex: 'cash', 'receivable', 'cogs', 'salary')
  account_type      text        not null,

  -- Saldo normal contábil (débito para Ativo/Despesa, crédito para Passivo/PL/Receita)
  normal_balance    text        not null default 'debit'
    check (normal_balance in ('debit', 'credit')),

  -- Hierarquia (auto-referência com restrição para evitar deleção de pais com filhos)
  parent_account_id uuid        references chart_accounts_v2(id) on delete restrict,
  level             integer     not null default 1
    check (level between 1 and 5),

  -- Contas sintéticas calculadas automaticamente pelo engine IFRS (Story 1.2)
  -- Ex: Receita Líquida, Lucro Bruto, EBIT, EBITDA, Lucro Líquido
  is_calculated     boolean     not null default false,

  is_active         boolean     not null default true,

  -- Multi-empresa
  company_id        uuid        references companies(id) on delete cascade,

  -- Auditoria
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Unicidade: cada empresa tem seus próprios códigos de conta
  constraint uq_chart_accounts_v2_company_code
    unique (company_id, account_code),

  -- Validação do formato hierárquico: N, N.N, N.N.N, N.N.N.N, N.N.N.N.N
  constraint chk_account_code_format
    check (account_code ~ '^\d+(\.\d+){0,4}$')
);

-- ============================================================
-- RLS: chart_accounts_v2
-- ============================================================
alter table chart_accounts_v2 enable row level security;

drop policy if exists "users manage their chart_accounts_v2" on chart_accounts_v2;
create policy "users manage their chart_accounts_v2"
  on chart_accounts_v2 for all
  using (
    company_id in (select id from companies where user_id = auth.uid())
  );

-- ============================================================
-- INDEXES: chart_accounts_v2
-- ============================================================
create index if not exists idx_chart_accounts_v2_company
  on chart_accounts_v2 (company_id);

create index if not exists idx_chart_accounts_v2_parent
  on chart_accounts_v2 (company_id, parent_account_id);

create index if not exists idx_chart_accounts_v2_class
  on chart_accounts_v2 (company_id, account_class);

create index if not exists idx_chart_accounts_v2_code
  on chart_accounts_v2 (company_id, account_code);

-- ============================================================
-- ALTER: financial_entries — FK opcional para chart_accounts_v2
-- ============================================================
-- Nullable: não quebra o chart_account_id original (NOT NULL).
-- Permite migração gradual: lançamentos antigos apontam para chart_accounts,
-- novos lançamentos podem apontar para chart_accounts_v2.
alter table financial_entries
  add column if not exists chart_account_v2_id uuid
    references chart_accounts_v2(id) on delete restrict;

-- Índice parcial: apenas para linhas que usam a nova FK
create index if not exists idx_financial_entries_chart_v2
  on financial_entries (chart_account_v2_id)
  where chart_account_v2_id is not null;
