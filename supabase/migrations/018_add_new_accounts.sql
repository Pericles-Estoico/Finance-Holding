-- Migration 018: Novas contas gerenciais + subdivisões de Pró-labore
-- Tabela: chart_accounts (plano 1-11, formulário de lançamentos)
-- Company: a4e864f8-f63d-4a51-af5f-0fa2eb91aa51
--
-- Contas adicionadas:
--   5.7  Acertos Trabalhistas
--   5.8  Processos Trabalhistas
--   8.6  Venda de Ativos Imobilizados
--   5.2.1 Pericles           (sub Pró-labore)
--   5.2.2 Stella             (sub Pró-labore)
--   5.2.3 Kalev              (sub Pró-labore)
--   5.2.4 Felipe             (sub Pró-labore)
--   5.2.5 Doações            (sub Pró-labore)
--   5.2.6 Família            (sub Pró-labore)

-- ── Contas nível 2 ───────────────────────────────────────────────────────────

INSERT INTO chart_accounts
  (company_id, code, name, level, account_type,
   dre_group, ebitda_group, cash_flow_group,
   affects_dre, affects_ebitda, affects_cash_flow, is_active)
VALUES
  -- 5.7 Acertos Trabalhistas (rescisões, multa FGTS, exames — não recorrente)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '5.7', 'Acertos Trabalhistas', 2, 'administrative_expense',
   'administrative_expenses', 'excluded_from_ebitda', 'operating_outflow',
   true, true, true, true),

  -- 5.8 Processos Trabalhistas (acordos, honorários advocatícios)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '5.8', 'Processos Trabalhistas', 2, 'administrative_expense',
   'administrative_expenses', 'excluded_from_ebitda', 'operating_outflow',
   true, true, true, true),

  -- 8.6 Venda de Ativos Imobilizados (receita não operacional)
  ('a4e864f8-f63d-4a51-af5f-0fa2eb91aa51',
   '8.6', 'Venda de Ativos Imobilizados', 2, 'financial_income',
   'financial_result', 'excluded_from_ebitda', 'financing_inflow',
   true, false, true, true)

ON CONFLICT (company_id, code) DO NOTHING;

-- ── Sub-contas nível 3 de Pró-labore (5.2.x) ─────────────────────────────────
-- parent_id resolvido via subquery em tempo de execução

INSERT INTO chart_accounts
  (company_id, code, name, level, parent_id, account_type,
   dre_group, ebitda_group, cash_flow_group,
   affects_dre, affects_ebitda, affects_cash_flow, is_active)
SELECT
  p.company_id,
  v.code,
  v.name,
  3,
  p.id,
  'administrative_expense',
  'administrative_expenses',
  'excluded_from_ebitda',
  'owner_withdrawal',
  true, true, true, true
FROM chart_accounts p
CROSS JOIN (VALUES
  ('5.2.1', 'Pericles'),
  ('5.2.2', 'Stella'),
  ('5.2.3', 'Kalev'),
  ('5.2.4', 'Felipe'),
  ('5.2.5', 'Doações'),
  ('5.2.6', 'Família')
) AS v(code, name)
WHERE p.company_id = 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51'
  AND p.code = '5.2'
ON CONFLICT (company_id, code) DO NOTHING;
