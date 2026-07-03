-- Migration 016: Unifica plano de contas em transactions
-- Adiciona chart_account_id (referencia chart_accounts, o mesmo plano usado por financial_entries/Lançamentos)
-- Permite que a tela Transações use o mesmo plano de contas que a tela Lançamentos.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS chart_account_id uuid
  REFERENCES public.chart_accounts(id) ON DELETE RESTRICT;
