-- Migration 015: Adiciona 3.8.5 Despesas de Viagem em chart_accounts_v2
-- para a empresa a4e864f8-f63d-4a51-af5f-0fa2eb91aa51 (Stella Braz)

INSERT INTO chart_accounts_v2
  (account_code, account_name, description, account_class, account_type, normal_balance, parent_account_id, level, is_calculated, is_active, company_id)
VALUES
  ('3.8.5', 'Despesas de Viagem', 'Passagens, hospedagem, alimentação e transporte em viagens', 'EXPENSE', 'despesa_operacional', 'debit', NULL, 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51')
ON CONFLICT DO NOTHING;
