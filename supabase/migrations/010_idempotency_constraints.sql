-- Story 5.2: Prevent duplicate transactions from same Drive file.
-- OFX duplicates are already prevented at ofx_pending_entries(company_id, fit_id).

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_drive_file
  ON public.transactions (company_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;
