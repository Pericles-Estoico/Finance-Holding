-- Migration 012: Adiciona contas de Combustível e Logística ao plano de contas V2
-- Inseridas como grupo 3.8 — Logística e Transporte (despesa_operacional)

BEGIN;

-- Grupo pai: 3.8 Logística e Transporte
INSERT INTO chart_accounts_v2
  (account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, is_active, company_id, description, parent_account_id, created_by)
VALUES
  ('3.8',   'Logística e Transporte',    'EXPENSE', 'despesa_operacional', 'debit', 2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Custos de movimentação, entregas e combustíveis', null, null),
  ('3.8.1', 'Combustível Empresa',       'EXPENSE', 'despesa_operacional', 'debit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Combustível de veículos próprios da empresa', null, null),
  ('3.8.2', 'Combustível Terceiros',     'EXPENSE', 'despesa_operacional', 'debit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Reembolso de combustível a parceiros, motoboys e colaboradores', null, null),
  ('3.8.3', 'Frete e Entrega',           'EXPENSE', 'despesa_operacional', 'debit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Correios, transportadoras, frete de insumos', null, null),
  ('3.8.4', 'Manutenção de Veículos',    'EXPENSE', 'despesa_operacional', 'debit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Revisão, pneus, peças e serviços mecânicos', null, null)
ON CONFLICT (account_code, company_id) DO NOTHING;

-- Equivalente no plano de contas legado (chart_accounts via seed function)
-- Adicionar via função seed_default_chart_accounts também para empresas novas

COMMIT;
