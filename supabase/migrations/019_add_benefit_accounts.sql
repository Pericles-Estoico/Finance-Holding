-- Migration 019: Contas de benefícios e vales para funcionários
-- Tabela: chart_accounts
-- Company: a4e864f8-f63d-4a51-af5f-0fa2eb91aa51
--
-- Contas adicionadas:
--   5.9  Vale Refeição
--   5.10 Premiação Funcionários
--   5.11 Vale de Pagamentos

INSERT INTO chart_accounts
  (company_id, code, name, level, account_type,
   dre_group, ebitda_group, cash_flow_group,
   affects_dre, affects_ebitda, affects_cash_flow, is_active)
VALUES
  -- 5.9 Vale Refeição (benefício recorrente — compõe EBITDA)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '5.9', 'Vale Refeição', 2, 'administrative_expense',
   'administrative_expenses', 'administrative_expenses', 'operating_outflow',
   true, true, true, true),

  -- 5.10 Premiação Funcionários (bônus recorrente — compõe EBITDA)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '5.10', 'Premiação Funcionários', 2, 'administrative_expense',
   'administrative_expenses', 'administrative_expenses', 'operating_outflow',
   true, true, true, true),

  -- 5.11 Vale de Pagamentos (pagamentos diversos via vale — compõe EBITDA)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '5.11', 'Vale de Pagamentos', 2, 'administrative_expense',
   'administrative_expenses', 'administrative_expenses', 'operating_outflow',
   true, true, true, true)

ON CONFLICT (company_id, code) DO NOTHING;
