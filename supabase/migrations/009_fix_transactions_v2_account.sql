-- Story 5.1: Allow transactions and payee_account_rules to reference chart_accounts_v2
-- Fixes FK violation when classifying Drive receipts with Corporate Chart V2 accounts.

-- 1. transactions: add v2 column, make account_id nullable
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS chart_account_v2_id uuid
  REFERENCES public.chart_accounts_v2(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions
  ALTER COLUMN account_id DROP NOT NULL;

-- Ensure at least one account reference is always present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_has_account'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_transactions_has_account
      CHECK (account_id IS NOT NULL OR chart_account_v2_id IS NOT NULL);
  END IF;
END $$;

-- 2. payee_account_rules: add v2 column, make account_id nullable
ALTER TABLE public.payee_account_rules
  ADD COLUMN IF NOT EXISTS chart_account_v2_id uuid
  REFERENCES public.chart_accounts_v2(id) ON DELETE CASCADE;

ALTER TABLE public.payee_account_rules
  ALTER COLUMN account_id DROP NOT NULL;
