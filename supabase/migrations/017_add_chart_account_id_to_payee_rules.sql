-- Adiciona chart_account_id à payee_account_rules para suportar o plano unificado (chart_accounts)
-- account_id vira nullable para compatibilidade com regras antigas (chart_of_accounts)

ALTER TABLE public.payee_account_rules
  ALTER COLUMN account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS chart_account_id uuid REFERENCES public.chart_accounts(id) ON DELETE CASCADE;
