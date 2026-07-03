-- Migration 014: Adiciona Despesas de Viagem (6.7)
-- na tabela chart_accounts para a empresa a4e864f8-f63d-4a51-af5f-0fa2eb91aa51

INSERT INTO chart_accounts
  (company_id, code, name, level, account_type, dre_group, ebitda_group, cash_flow_group, affects_dre, affects_ebitda, affects_cash_flow, is_active)
VALUES
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', '6.7', 'Despesas de Viagem', 2, 'operational_expense', 'operational_expenses', 'operational_expenses', 'operating_outflow', true, true, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
