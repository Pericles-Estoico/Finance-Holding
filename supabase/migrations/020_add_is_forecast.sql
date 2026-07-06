-- Migration 020: Previsão de fluxo de caixa
-- Adiciona coluna is_forecast em financial_entries
-- Quando true: lançamento é previsão futura (não realizado)
-- Quando false (default): lançamento realizado ou agendado normal

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS is_forecast BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN financial_entries.is_forecast IS
  'true = lançamento de previsão/orçamento; false = lançamento realizado ou a pagar/receber';
