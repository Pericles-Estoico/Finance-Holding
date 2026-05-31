-- ============================================================
-- Migration 007: Pró-labore, encargos de sócio e distribuição de lucros
-- Complementa migration 006 — cobre lacuna de remuneração de sócios
-- ============================================================
-- Função idempotente: verifica existência via on conflict do nothing.
-- NÃO modifica contas existentes — apenas adiciona.
-- parent_account_id resolvido por subquery em account_code.
--
-- Estrutura adicionada:
--   DRE (despesa administrativa):
--     5.3.2.1.6  Pró-labore - Sócios
--     5.3.2.1.7  INSS sobre Pró-labore (parte empresa, 20% folha)
--     5.3.2.1.8  IRRF sobre Pró-labore
--
--   PASSIVO (obrigações a recolher):
--     2.1.2.7    Pró-labore a Pagar
--     2.1.2.8    INSS sobre Pró-labore a Recolher
--
--   PATRIMÔNIO LÍQUIDO (redutora de PL — não passa pela DRE):
--     3.4.3      (-) Distribuição de Lucros aos Sócios
--
-- IMPORTANTE: Pró-labore VAI para DRE como despesa operacional administrativa.
-- Distribuição de Lucros NÃO vai para DRE — debita PL diretamente.
-- Esta separação é exigida pela legislação fiscal brasileira (IRPJ/CSLL).
-- ============================================================

create or replace function seed_partner_compensation(p_company_id uuid)
returns void language plpgsql as $$
begin

  -- ======================================================
  -- DRE: Despesas operacionais administrativas (5.3.2.1.x)
  -- ======================================================
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EXPENSE', v.atype, 'debit', 5, false, p.id
  from (values
    ('5.3.2.1.6', 'Pró-labore - Sócios',                 'partner_compensation'),
    ('5.3.2.1.7', 'INSS sobre Pró-labore (Patronal)',    'partner_inss_employer'),
    ('5.3.2.1.8', 'IRRF sobre Pró-labore',               'partner_irrf')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = '5.3.2.1'
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- PASSIVO CIRCULANTE: Obrigações trabalhistas (2.1.2.x)
  -- ======================================================
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'LIABILITY', v.atype, 'credit', 4, false, p.id
  from (values
    ('2.1.2.7', 'Pró-labore a Pagar',                  'partner_compensation_payable'),
    ('2.1.2.8', 'INSS sobre Pró-labore a Recolher',    'partner_inss_payable')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = '2.1.2'
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- PATRIMÔNIO LÍQUIDO: Distribuição de lucros (3.4.x)
  -- ATENÇÃO: normal_balance DÉBITO porque é conta REDUTORA do PL.
  -- Equity normalmente tem saldo crédito, mas dividendos pagos
  -- diminuem o PL, então acumulam em conta de saldo devedor.
  -- ======================================================
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EQUITY', v.atype, 'debit', 3, false, p.id
  from (values
    ('3.4.3', '(-) Distribuição de Lucros aos Sócios', 'profit_distribution')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = '3.4'
  on conflict (company_id, account_code) do nothing;

end;
$$;

-- ============================================================
-- Aplicação automática para empresas existentes
-- ============================================================
-- Roda a função para todas as companies já cadastradas.
-- Para novas empresas, esta função deve ser chamada no fluxo
-- de criação da empresa (mesmo padrão de seed_corporate_chart).
-- ============================================================
do $$
declare
  v_company record;
begin
  for v_company in select id from companies loop
    perform seed_partner_compensation(v_company.id);
  end loop;
end;
$$;
