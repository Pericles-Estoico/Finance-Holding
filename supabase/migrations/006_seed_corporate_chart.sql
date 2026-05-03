-- ============================================================
-- Migration 006: Seed do Plano de Contas Corporativo IPO/M&A
-- Story 1.4 — EPIC-1
-- ============================================================
-- Função idempotente: verifica existência antes de inserir.
-- Insere em ordem: nível 1 → 2 → 3 → 4 → 5.
-- parent_account_id resolvido por subquery em account_code.
-- ============================================================

create or replace function seed_corporate_chart(p_company_id uuid)
returns void language plpgsql as $$
begin

  -- ======================================================
  -- NÍVEL 1: Grupos Raiz das 5 Classes
  -- ======================================================
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated)
  values
    (p_company_id, '1', 'ATIVOS',              'ASSET',     'asset_group',    'debit',  1, false),
    (p_company_id, '2', 'PASSIVOS',            'LIABILITY', 'liability_group','credit', 1, false),
    (p_company_id, '3', 'PATRIMÔNIO LÍQUIDO',  'EQUITY',    'equity_group',   'credit', 1, false),
    (p_company_id, '4', 'RECEITAS',            'REVENUE',   'revenue_group',  'credit', 1, false),
    (p_company_id, '5', 'CUSTOS E DESPESAS',   'EXPENSE',   'expense_group',  'debit',  1, false)
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- NÍVEL 2
  -- ======================================================

  -- ASSET L2
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'ASSET', v.atype, 'debit', 2, false, p.id
  from (values
    ('1.1', 'ATIVOS CIRCULANTES',       'current_asset_group'),
    ('1.2', 'ATIVOS NÃO CIRCULANTES',   'noncurrent_asset_group')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = substring(v.code, 1, 1)
  on conflict (company_id, account_code) do nothing;

  -- LIABILITY L2
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'LIABILITY', v.atype, 'credit', 2, false, p.id
  from (values
    ('2.1', 'PASSIVOS CIRCULANTES',     'current_liability_group'),
    ('2.2', 'PASSIVOS NÃO CIRCULANTES', 'noncurrent_liability_group')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = substring(v.code, 1, 1)
  on conflict (company_id, account_code) do nothing;

  -- EQUITY L2
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EQUITY', v.atype, 'credit', 2, false, p.id
  from (values
    ('3.1', 'Capital Social',                   'paid_in_capital'),
    ('3.2', 'Reservas de Capital',              'capital_reserve'),
    ('3.3', 'Reservas de Lucros',               'earnings_reserve'),
    ('3.4', 'Lucros/Prejuízos Acumulados',      'retained_earnings'),
    ('3.5', 'Ajustes de Avaliação Patrimonial', 'other_comprehensive_income')
  ) as v(code, name, atype)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = substring(v.code, 1, 1)
  on conflict (company_id, account_code) do nothing;

  -- REVENUE L2
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'REVENUE', v.atype, 'credit', 2, v.calc, p.id
  from (values
    ('4.1', 'RECEITA OPERACIONAL BRUTA',    'gross_revenue',        false),
    ('4.2', 'DEDUÇÕES DA RECEITA BRUTA',    'revenue_deduction',    false),
    ('4.3', 'RECEITA OPERACIONAL LÍQUIDA',  'net_revenue',          true),
    ('4.4', 'RECEITAS NÃO OPERACIONAIS',    'non_operating_revenue',false)
  ) as v(code, name, atype, calc)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = substring(v.code, 1, 1)
  on conflict (company_id, account_code) do nothing;

  -- EXPENSE L2
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EXPENSE', v.atype, 'debit', 2, v.calc, p.id
  from (values
    ('5.1', 'CUSTO DOS PRODUTOS VENDIDOS (CPV)', 'cogs',                 false),
    ('5.2', 'LUCRO BRUTO',                       'gross_profit',         true),
    ('5.3', 'DESPESAS OPERACIONAIS',             'operating_expense',    false),
    ('5.4', 'LUCRO OPERACIONAL (EBIT)',           'ebit',                 true),
    ('5.5', 'EBITDA',                            'ebitda',               true),
    ('5.6', 'DESPESAS NÃO OPERACIONAIS',         'non_operating_expense',false),
    ('5.7', 'LUCRO ANTES DOS IMPOSTOS',          'ebt',                  true),
    ('5.8', 'IMPOSTOS SOBRE O LUCRO',            'income_tax',           false),
    ('5.9', 'LUCRO LÍQUIDO',                     'net_income',           true)
  ) as v(code, name, atype, calc)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = substring(v.code, 1, 1)
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- NÍVEL 3
  -- ======================================================

  -- ASSET L3 — Circulante
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'ASSET', v.atype, 'debit', 3, false, p.id
  from (values
    ('1.1.1', 'Caixa e Equivalentes',         'cash_equivalent',    '1.1'),
    ('1.1.2', 'Contas a Receber',             'receivable',         '1.1'),
    ('1.1.3', 'Estoques',                     'inventory',          '1.1'),
    ('1.1.4', 'Despesas Antecipadas',         'prepaid_expense',    '1.1'),
    ('1.1.5', 'Outros Ativos Circulantes',    'other_current_asset','1.1'),
    ('1.2.1', 'Realizáveis a Longo Prazo',    'long_term_receivable','1.2'),
    ('1.2.2', 'Investimentos',                'investment',         '1.2'),
    ('1.2.3', 'Imobilizado (Ativo Fixo)',     'fixed_asset',        '1.2'),
    ('1.2.4', 'Intangíveis',                  'intangible',         '1.2'),
    ('1.2.5', 'Ativo Diferido',              'deferred_asset',     '1.2')
  ) as v(code, name, atype, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- LIABILITY L3
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'LIABILITY', v.atype, 'credit', 3, false, p.id
  from (values
    ('2.1.1', 'Contas a Pagar',                      'payable',              '2.1'),
    ('2.1.2', 'Obrigações Trabalhistas',             'labor_obligation',     '2.1'),
    ('2.1.3', 'Obrigações Tributárias',              'tax_obligation',       '2.1'),
    ('2.1.4', 'Empréstimos e Financiamentos (CP)',   'short_term_debt',      '2.1'),
    ('2.1.5', 'Receitas Diferidas',                  'deferred_revenue',     '2.1'),
    ('2.1.6', 'Provisões (CP)',                      'provision',            '2.1'),
    ('2.1.7', 'Outros Passivos Circulantes',         'other_current_liab',   '2.1'),
    ('2.2.1', 'Empréstimos e Financiamentos (LP)',   'long_term_debt',       '2.2'),
    ('2.2.2', 'Obrigações Pós-Emprego',             'post_employ_benefit',  '2.2'),
    ('2.2.3', 'Provisões (LP)',                      'long_term_provision',  '2.2'),
    ('2.2.4', 'Passivos Diferidos',                  'deferred_liability',   '2.2')
  ) as v(code, name, atype, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- EQUITY L3
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EQUITY', 'equity_account', 'credit', 3, false, p.id
  from (values
    ('3.1.1', 'Capital Social Integralizado',           '3.1'),
    ('3.1.2', 'Capital Social a Integralizar',          '3.1'),
    ('3.1.3', '(-) Ações em Tesouraria',               '3.1'),
    ('3.2.1', 'Reserva de Ágio na Emissão de Ações',   '3.2'),
    ('3.2.2', 'Reserva de Doações',                    '3.2'),
    ('3.2.3', 'Reserva de Subvenção para Investimento','3.2'),
    ('3.3.1', 'Reserva Legal',                         '3.3'),
    ('3.3.2', 'Reserva de Contingência',               '3.3'),
    ('3.3.3', 'Reserva de Lucros a Realizar',          '3.3'),
    ('3.3.4', 'Reserva de Retenção de Lucros',         '3.3'),
    ('3.3.5', 'Reserva para Investimento',             '3.3'),
    ('3.4.1', 'Lucro/Prejuízo do Exercício',           '3.4'),
    ('3.4.2', 'Lucro/Prejuízo de Exercícios Anteriores','3.4'),
    ('3.5.1', 'Ajuste de Conversão de Moeda',          '3.5'),
    ('3.5.2', 'Ajuste de Valor Justo de Investimentos','3.5'),
    ('3.5.3', 'Ajuste Atuarial de Planos de Benefício','3.5')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- REVENUE L3
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'REVENUE', v.atype, 'credit', 3, false, p.id
  from (values
    ('4.1.1', 'Receita de Vendas - Produtos',     'product_revenue',      '4.1'),
    ('4.1.2', 'Receita de Serviços',              'service_revenue',      '4.1'),
    ('4.1.3', 'Outras Receitas Operacionais',     'other_op_revenue',     '4.1'),
    ('4.2.1', 'Devoluções de Vendas',             'sales_return',         '4.2'),
    ('4.2.2', 'Descontos Comerciais',             'commercial_discount',  '4.2'),
    ('4.2.3', 'Abatimentos',                      'allowance',            '4.2'),
    ('4.2.4', 'Impostos sobre Vendas',            'sales_tax',            '4.2'),
    ('4.4.1', 'Receita Financeira',               'financial_income',     '4.4'),
    ('4.4.2', 'Outras Receitas Não Operacionais', 'other_non_op_revenue', '4.4')
  ) as v(code, name, atype, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- EXPENSE L3
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EXPENSE', v.atype, 'debit', 3, false, p.id
  from (values
    ('5.1.1', 'Matéria-Prima',                    'raw_material',        '5.1'),
    ('5.1.2', 'Mão de Obra Direta',               'direct_labor',        '5.1'),
    ('5.1.3', 'Custos Indiretos de Produção',     'overhead',            '5.1'),
    ('5.1.4', 'Embalagem e Acabamento',           'packaging',           '5.1'),
    ('5.1.5', 'Logística de Entrada',             'inbound_logistics',   '5.1'),
    ('5.1.6', 'Variação de Estoque',              'inventory_variance',  '5.1'),
    ('5.3.1', 'Despesas Comerciais',              'commercial_expense',  '5.3'),
    ('5.3.2', 'Despesas Administrativas',         'admin_expense',       '5.3'),
    ('5.3.3', 'Despesas Financeiras',             'financial_expense',   '5.3'),
    ('5.6.1', 'Despesas Não Operacionais',        'non_op_expense',      '5.6'),
    ('5.6.2', 'Provisões',                        'provision_expense',   '5.6'),
    ('5.8.1', 'Imposto de Renda (IRPJ)',          'income_tax_irpj',     '5.8'),
    ('5.8.2', 'Contribuição Social (CSLL)',       'income_tax_csll',     '5.8')
  ) as v(code, name, atype, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- NÍVEL 4
  -- ======================================================

  -- ASSET L4
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'ASSET', 'asset_account', 'debit', 4, false, p.id
  from (values
    -- Caixa e Equivalentes
    ('1.1.1.1', 'Caixa em Espécie',                          '1.1.1'),
    ('1.1.1.2', 'Bancos Conta Corrente',                     '1.1.1'),
    ('1.1.1.3', 'Bancos Conta Poupança',                     '1.1.1'),
    ('1.1.1.4', 'Equivalentes de Caixa (Aplicações < 90d)', '1.1.1'),
    ('1.1.1.5', 'Caixa Restrito (Garantias)',                '1.1.1'),
    -- Contas a Receber
    ('1.1.2.1', 'Contas a Receber - Clientes',              '1.1.2'),
    ('1.1.2.2', 'Contas a Receber - Marketplace',           '1.1.2'),
    ('1.1.2.3', 'Contas a Receber - Varejo Físico',         '1.1.2'),
    ('1.1.2.4', 'Contas a Receber - B2B/Distribuição',      '1.1.2'),
    ('1.1.2.5', 'Contas a Receber - Outros',                '1.1.2'),
    ('1.1.2.6', '(-) Provisão para Devedores Duvidosos',    '1.1.2'),
    ('1.1.2.7', '(-) Desconto Comercial Concedido',         '1.1.2'),
    -- Estoques
    ('1.1.3.1', 'Estoque de Matéria-Prima',                 '1.1.3'),
    ('1.1.3.2', 'Estoque de Produtos em Processo',          '1.1.3'),
    ('1.1.3.3', 'Estoque de Produtos Acabados',             '1.1.3'),
    ('1.1.3.4', 'Estoque em Trânsito',                      '1.1.3'),
    ('1.1.3.5', 'Estoque em Consignação',                   '1.1.3'),
    ('1.1.3.6', '(-) Provisão para Obsolescência',          '1.1.3'),
    ('1.1.3.7', '(-) Ajuste ao Valor de Mercado',           '1.1.3'),
    -- Despesas Antecipadas
    ('1.1.4.1', 'Seguros Antecipados',                      '1.1.4'),
    ('1.1.4.2', 'Aluguéis Antecipados',                     '1.1.4'),
    ('1.1.4.3', 'Assinaturas de Software Antecipadas',      '1.1.4'),
    ('1.1.4.4', 'Publicidade Antecipada',                   '1.1.4'),
    ('1.1.4.5', 'Outras Despesas Antecipadas',              '1.1.4'),
    -- Outros Ativos Circulantes
    ('1.1.5.1', 'Adiantamentos a Fornecedores',             '1.1.5'),
    ('1.1.5.2', 'Adiantamentos a Funcionários',             '1.1.5'),
    ('1.1.5.3', 'Impostos a Recuperar (ICMS, IPI, PIS/COFINS)','1.1.5'),
    ('1.1.5.4', 'Créditos Tributários',                     '1.1.5'),
    ('1.1.5.5', 'Valores a Receber de Terceiros',           '1.1.5'),
    -- Realizáveis LP
    ('1.2.1.1', 'Contas a Receber - Longo Prazo',           '1.2.1'),
    ('1.2.1.2', 'Empréstimos a Coligadas/Controladas',      '1.2.1'),
    ('1.2.1.3', 'Depósitos Caução',                         '1.2.1'),
    ('1.2.1.4', 'Outras Contas a Receber - LP',             '1.2.1'),
    -- Investimentos
    ('1.2.2.1', 'Investimentos em Coligadas',               '1.2.2'),
    ('1.2.2.2', 'Investimentos em Controladas',             '1.2.2'),
    ('1.2.2.3', 'Investimentos em Outras Empresas',         '1.2.2'),
    ('1.2.2.4', 'Ações e Títulos (Longo Prazo)',            '1.2.2'),
    -- Imobilizado
    ('1.2.3.1', 'Terrenos',                                 '1.2.3'),
    ('1.2.3.2', 'Edifícios e Construções',                  '1.2.3'),
    ('1.2.3.3', 'Máquinas e Equipamentos',                  '1.2.3'),
    ('1.2.3.4', 'Móveis e Utensílios',                      '1.2.3'),
    ('1.2.3.5', 'Veículos',                                 '1.2.3'),
    ('1.2.3.6', 'Sistemas e Softwares (Capitalizados)',      '1.2.3'),
    ('1.2.3.7', 'Benfeitorias em Imóvel Alugado',           '1.2.3'),
    ('1.2.3.8', '(-) Depreciação Acumulada - Edifícios',    '1.2.3'),
    ('1.2.3.9', '(-) Depreciação Acumulada - Máquinas',     '1.2.3'),
    ('1.2.3.10','(-) Depreciação Acumulada - Móveis',       '1.2.3'),
    ('1.2.3.11','(-) Depreciação Acumulada - Veículos',     '1.2.3'),
    ('1.2.3.12','(-) Depreciação Acumulada - Outros',       '1.2.3'),
    -- Intangíveis
    ('1.2.4.1', 'Goodwill (Ágio em Aquisição)',             '1.2.4'),
    ('1.2.4.2', 'Marcas e Patentes',                        '1.2.4'),
    ('1.2.4.3', 'Softwares (Licenças Perpétuas)',           '1.2.4'),
    ('1.2.4.4', 'Direitos de Uso (IFRS 16)',                '1.2.4'),
    ('1.2.4.5', 'Clientes/Relacionamentos Adquiridos',      '1.2.4'),
    ('1.2.4.6', '(-) Amortização Acumulada - Goodwill',     '1.2.4'),
    ('1.2.4.7', '(-) Amortização Acumulada - Marcas',       '1.2.4'),
    ('1.2.4.8', '(-) Amortização Acumulada - Softwares',    '1.2.4'),
    ('1.2.4.9', '(-) Amortização Acumulada - Outros',       '1.2.4'),
    -- Ativo Diferido
    ('1.2.5.1', 'Despesas Pré-Operacionais',                '1.2.5'),
    ('1.2.5.2', 'Custos de Implantação de Sistemas',        '1.2.5'),
    ('1.2.5.3', 'Outros Ativos Diferidos',                  '1.2.5')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- LIABILITY L4
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'LIABILITY', 'liability_account', 'credit', 4, false, p.id
  from (values
    ('2.1.1.1', 'Contas a Pagar - Fornecedores Nacionais',  '2.1.1'),
    ('2.1.1.2', 'Contas a Pagar - Fornecedores Importação', '2.1.1'),
    ('2.1.1.3', 'Contas a Pagar - Serviços',               '2.1.1'),
    ('2.1.1.4', 'Contas a Pagar - Aluguel',                '2.1.1'),
    ('2.1.1.5', 'Contas a Pagar - Utilities',              '2.1.1'),
    ('2.1.1.6', 'Contas a Pagar - Outros',                 '2.1.1'),
    ('2.1.2.1', 'Salários e Encargos a Pagar',             '2.1.2'),
    ('2.1.2.2', 'FGTS a Pagar',                            '2.1.2'),
    ('2.1.2.3', 'Contribuição Sindical a Pagar',           '2.1.2'),
    ('2.1.2.4', 'Férias Acumuladas (Provisão)',            '2.1.2'),
    ('2.1.2.5', '13º Salário (Provisão)',                  '2.1.2'),
    ('2.1.2.6', 'Bônus e Participação nos Lucros',         '2.1.2'),
    ('2.1.3.1', 'ICMS a Pagar',                            '2.1.3'),
    ('2.1.3.2', 'IPI a Pagar',                             '2.1.3'),
    ('2.1.3.3', 'PIS/COFINS a Pagar',                      '2.1.3'),
    ('2.1.3.4', 'IRPJ a Pagar',                            '2.1.3'),
    ('2.1.3.5', 'CSLL a Pagar',                            '2.1.3'),
    ('2.1.3.6', 'ISS a Pagar',                             '2.1.3'),
    ('2.1.3.7', 'Impostos Municipais a Pagar',             '2.1.3'),
    ('2.1.3.8', 'Outras Obrigações Tributárias',           '2.1.3'),
    ('2.1.4.1', 'Empréstimo Bancário - CP',                '2.1.4'),
    ('2.1.4.2', 'Financiamento de Equipamentos - CP',      '2.1.4'),
    ('2.1.4.3', 'Cheque Especial',                         '2.1.4'),
    ('2.1.4.4', 'Antecipação de Recebíveis (ACC/ACE)',     '2.1.4'),
    ('2.1.4.5', 'Empréstimo de Coligadas - CP',            '2.1.4'),
    ('2.1.4.6', 'Leasing - Parcela CP',                    '2.1.4'),
    ('2.1.5.1', 'Adiantamentos de Clientes',               '2.1.5'),
    ('2.1.5.2', 'Receita de Assinatura Antecipada',        '2.1.5'),
    ('2.1.6.1', 'Provisão para Devoluções de Produtos',    '2.1.6'),
    ('2.1.6.2', 'Provisão para Garantia de Produtos',      '2.1.6'),
    ('2.1.6.3', 'Provisão para Processos Judiciais',       '2.1.6'),
    ('2.1.6.4', 'Provisão para Reestruturação',            '2.1.6'),
    ('2.1.6.5', 'Outras Provisões (CP)',                   '2.1.6'),
    ('2.1.7.1', 'Dividendos a Pagar',                      '2.1.7'),
    ('2.1.7.2', 'Juros a Pagar',                           '2.1.7'),
    ('2.1.7.3', 'Outras Obrigações Circulantes',           '2.1.7'),
    ('2.2.1.1', 'Empréstimo Bancário - LP',                '2.2.1'),
    ('2.2.1.2', 'Financiamento de Equipamentos - LP',      '2.2.1'),
    ('2.2.1.3', 'Debêntures',                              '2.2.1'),
    ('2.2.1.4', 'Empréstimo de Coligadas - LP',            '2.2.1'),
    ('2.2.1.5', 'Leasing - Parcela LP',                    '2.2.1'),
    ('2.2.2.1', 'Provisão para Plano de Pensão',           '2.2.2'),
    ('2.2.2.2', 'Provisão para Bônus de Longo Prazo',      '2.2.2'),
    ('2.2.2.3', 'Provisão para Indenizações',              '2.2.2'),
    ('2.2.3.1', 'Provisão para Processos Judiciais - LP',  '2.2.3'),
    ('2.2.3.2', 'Provisão para Remediação Ambiental',      '2.2.3'),
    ('2.2.3.3', 'Outras Provisões - LP',                   '2.2.3'),
    ('2.2.4.1', 'Receita Diferida - Longo Prazo',          '2.2.4'),
    ('2.2.4.2', 'Impostos Diferidos a Pagar',              '2.2.4')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- REVENUE L4
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'REVENUE', 'revenue_account', 'credit', 4, false, p.id
  from (values
    ('4.1.1.1', 'Vendas - Amazon',                          '4.1.1'),
    ('4.1.1.2', 'Vendas - Shopify/E-commerce Próprio',      '4.1.1'),
    ('4.1.1.3', 'Vendas - Marketplace B (Mercado Livre)',   '4.1.1'),
    ('4.1.1.4', 'Vendas - Varejo Físico',                   '4.1.1'),
    ('4.1.1.5', 'Vendas - B2B/Distribuição',                '4.1.1'),
    ('4.1.1.6', 'Vendas - Exportação',                      '4.1.1'),
    ('4.1.1.7', 'Vendas - Outros Canais',                   '4.1.1'),
    ('4.1.2.1', 'Receita de Serviços de Consultoria',       '4.1.2'),
    ('4.1.2.2', 'Receita de Serviços de Customização',      '4.1.2'),
    ('4.1.2.3', 'Receita de Manutenção',                    '4.1.2'),
    ('4.1.2.4', 'Receita de Instalação',                    '4.1.2'),
    ('4.1.3.1', 'Receita de Frete (Repassado ao Cliente)',  '4.1.3'),
    ('4.1.3.2', 'Receita de Embalagem',                     '4.1.3'),
    ('4.1.3.3', 'Receita de Devolução de Fornecedor',       '4.1.3'),
    ('4.2.1.1', 'Devoluções - Amazon',                      '4.2.1'),
    ('4.2.1.2', 'Devoluções - Shopify',                     '4.2.1'),
    ('4.2.1.3', 'Devoluções - Marketplace B',               '4.2.1'),
    ('4.2.1.4', 'Devoluções - Varejo Físico',               '4.2.1'),
    ('4.2.1.5', 'Devoluções - B2B',                         '4.2.1'),
    ('4.2.1.6', 'Devoluções - Outros',                      '4.2.1'),
    ('4.2.2.1', 'Desconto - Amazon',                        '4.2.2'),
    ('4.2.2.2', 'Desconto - Shopify',                       '4.2.2'),
    ('4.2.2.3', 'Desconto - Marketplace B',                 '4.2.2'),
    ('4.2.2.4', 'Desconto - Varejo Físico',                 '4.2.2'),
    ('4.2.2.5', 'Desconto - B2B',                           '4.2.2'),
    ('4.2.2.6', 'Desconto - Outros',                        '4.2.2'),
    ('4.2.3.1', 'Abatimento por Defeito',                   '4.2.3'),
    ('4.2.3.2', 'Abatimento Comercial',                     '4.2.3'),
    ('4.2.4.1', 'ICMS sobre Vendas',                        '4.2.4'),
    ('4.2.4.2', 'IPI sobre Vendas',                         '4.2.4'),
    ('4.2.4.3', 'PIS sobre Vendas',                         '4.2.4'),
    ('4.2.4.4', 'COFINS sobre Vendas',                      '4.2.4'),
    ('4.2.4.5', 'ISS sobre Vendas',                         '4.2.4'),
    ('4.2.4.6', 'Impostos Municipais sobre Vendas',         '4.2.4'),
    ('4.4.1.1', 'Juros Recebidos',                          '4.4.1'),
    ('4.4.1.2', 'Variação Cambial Positiva',                '4.4.1'),
    ('4.4.1.3', 'Ganho em Investimentos',                   '4.4.1'),
    ('4.4.1.4', 'Receita de Aplicação Financeira',          '4.4.1'),
    ('4.4.2.1', 'Ganho na Venda de Ativo Fixo',             '4.4.2'),
    ('4.4.2.2', 'Ganho na Venda de Investimento',           '4.4.2'),
    ('4.4.2.3', 'Indenização Recebida',                     '4.4.2'),
    ('4.4.2.4', 'Outras Receitas',                          '4.4.2')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- EXPENSE L4
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EXPENSE', 'expense_account', 'debit', 4, false, p.id
  from (values
    ('5.1.1.1', 'Matéria-Prima - Fornecedor A',              '5.1.1'),
    ('5.1.1.2', 'Matéria-Prima - Fornecedor B',              '5.1.1'),
    ('5.1.1.3', 'Matéria-Prima - Importação',                '5.1.1'),
    ('5.1.1.4', 'Matéria-Prima - Outros',                    '5.1.1'),
    ('5.1.2.1', 'Salários - Operários Produção',             '5.1.2'),
    ('5.1.2.2', 'Encargos Sociais - Produção',               '5.1.2'),
    ('5.1.2.3', 'Benefícios - Produção (VR, VT)',            '5.1.2'),
    ('5.1.2.4', 'Horas Extras - Produção',                   '5.1.2'),
    ('5.1.3.1', 'Energia Elétrica - Fábrica',                '5.1.3'),
    ('5.1.3.2', 'Água e Esgoto - Fábrica',                   '5.1.3'),
    ('5.1.3.3', 'Combustível - Fábrica',                     '5.1.3'),
    ('5.1.3.4', 'Manutenção de Máquinas',                    '5.1.3'),
    ('5.1.3.5', 'Manutenção de Instalações',                 '5.1.3'),
    ('5.1.3.6', 'Depreciação - Máquinas e Equipamentos',     '5.1.3'),
    ('5.1.3.7', 'Aluguel - Fábrica',                         '5.1.3'),
    ('5.1.3.8', 'Seguros - Fábrica',                         '5.1.3'),
    ('5.1.3.9', 'Materiais Indiretos',                       '5.1.3'),
    ('5.1.3.10','Terceirização de Processos Produtivos',      '5.1.3'),
    ('5.1.4.1', 'Embalagem Primária (Caixa, Plástico)',      '5.1.4'),
    ('5.1.4.2', 'Embalagem Secundária (Caixa de Envio)',     '5.1.4'),
    ('5.1.4.3', 'Etiquetas e Rótulos',                       '5.1.4'),
    ('5.1.4.4', 'Saquinhos e Acessórios',                    '5.1.4'),
    ('5.1.4.5', 'Mão de Obra - Embalagem',                   '5.1.4'),
    ('5.1.5.1', 'Frete - Fornecedores Nacionais',            '5.1.5'),
    ('5.1.5.2', 'Frete - Importação',                        '5.1.5'),
    ('5.1.5.3', 'Seguro de Frete',                           '5.1.5'),
    ('5.1.5.4', 'Desembaraço Aduaneiro',                     '5.1.5'),
    ('5.1.5.5', 'Armazenagem Temporária',                    '5.1.5'),
    ('5.1.6.1', 'Ajuste de Estoque (Diferença Inventário)',  '5.1.6'),
    ('5.1.6.2', 'Obsolescência de Estoque',                  '5.1.6'),
    ('5.1.6.3', 'Perda de Estoque (Roubo, Dano)',            '5.1.6'),
    ('5.3.1.1', 'Despesas de Vendas em Marketplaces',        '5.3.1'),
    ('5.3.1.2', 'Despesas de Logística de Saída',            '5.3.1'),
    ('5.3.1.3', 'Despesas de Marketing e Publicidade',       '5.3.1'),
    ('5.3.1.4', 'Despesas de Atendimento ao Cliente',        '5.3.1'),
    ('5.3.1.5', 'Despesas de Vendas Diretas',                '5.3.1'),
    ('5.3.2.1', 'Pessoal Administrativo',                    '5.3.2'),
    ('5.3.2.2', 'Infraestrutura Administrativa',             '5.3.2'),
    ('5.3.2.3', 'Despesas Administrativas Gerais',           '5.3.2'),
    ('5.3.2.4', 'Tecnologia e Sistemas',                     '5.3.2'),
    ('5.3.2.5', 'Depreciação e Amortização',                 '5.3.2'),
    ('5.3.3.1', 'Juros',                                     '5.3.3'),
    ('5.3.3.2', 'Variação Cambial',                          '5.3.3'),
    ('5.3.3.3', 'Outras Despesas Financeiras',               '5.3.3'),
    ('5.6.1.1', 'Perda na Venda de Ativo Fixo',              '5.6.1'),
    ('5.6.1.2', 'Perda na Venda de Investimento',            '5.6.1'),
    ('5.6.1.3', 'Multa Ambiental',                           '5.6.1'),
    ('5.6.1.4', 'Outras Despesas Não Operacionais',          '5.6.1'),
    ('5.6.2.1', 'Provisão para Processos Judiciais',         '5.6.2'),
    ('5.6.2.2', 'Provisão para Garantia de Produtos',        '5.6.2'),
    ('5.6.2.3', 'Provisão para Devoluções',                  '5.6.2'),
    ('5.6.2.4', 'Outras Provisões',                          '5.6.2'),
    ('5.8.1.1', 'IRPJ (Imposto de Renda PJ)',                '5.8.1'),
    ('5.8.1.2', '(-) Crédito de IRPJ',                       '5.8.1'),
    ('5.8.2.1', 'CSLL (Contribuição Social)',                 '5.8.2'),
    ('5.8.2.2', '(-) Crédito de CSLL',                       '5.8.2')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- ======================================================
  -- NÍVEL 5 — Contas folha mais granulares
  -- ======================================================

  -- ASSET L5
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'ASSET', 'asset_account', 'debit', 5, false, p.id
  from (values
    ('1.2.3.2.1', 'Fábrica',                     '1.2.3.2'),
    ('1.2.3.2.2', 'Escritório',                  '1.2.3.2'),
    ('1.2.3.2.3', 'Depósito',                    '1.2.3.2'),
    ('1.2.3.3.1', 'Máquinas de Produção',        '1.2.3.3'),
    ('1.2.3.3.2', 'Equipamentos de Informática', '1.2.3.3'),
    ('1.2.3.3.3', 'Equipamentos de Logística',   '1.2.3.3'),
    ('1.2.3.5.1', 'Veículos de Produção',        '1.2.3.5'),
    ('1.2.3.5.2', 'Veículos Administrativos',    '1.2.3.5'),
    ('1.2.3.5.3', 'Veículos de Entrega',         '1.2.3.5')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- REVENUE L5
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'REVENUE', 'revenue_account', 'credit', 5, false, p.id
  from (values
    ('4.1.1.1.1', 'Vendas Amazon - Categoria A', '4.1.1.1'),
    ('4.1.1.1.2', 'Vendas Amazon - Categoria B', '4.1.1.1'),
    ('4.1.1.1.3', 'Vendas Amazon - Categoria C', '4.1.1.1')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

  -- EXPENSE L5
  insert into chart_accounts_v2
    (company_id, account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, parent_account_id)
  select p_company_id, v.code, v.name, 'EXPENSE', 'expense_account', 'debit', 5, false, p.id
  from (values
    ('5.3.1.1.1', 'Taxa Amazon (Comissão)',              '5.3.1.1'),
    ('5.3.1.1.2', 'Taxa Shopify (Plataforma + Gateway)', '5.3.1.1'),
    ('5.3.1.1.3', 'Taxa Mercado Livre',                  '5.3.1.1'),
    ('5.3.1.1.4', 'Taxa Outros Marketplaces',            '5.3.1.1'),
    ('5.3.1.1.5', 'Publicidade Amazon (AMS)',            '5.3.1.1'),
    ('5.3.1.1.6', 'Publicidade Google Shopping',         '5.3.1.1'),
    ('5.3.1.1.7', 'Publicidade Facebook/Instagram',      '5.3.1.1'),
    ('5.3.1.2.1', 'Frete - Amazon FBA',                  '5.3.1.2'),
    ('5.3.1.2.2', 'Frete - Shopify (Envios)',             '5.3.1.2'),
    ('5.3.1.2.3', 'Frete - Varejo Físico',               '5.3.1.2'),
    ('5.3.1.2.4', 'Frete - B2B',                         '5.3.1.2'),
    ('5.3.1.2.5', 'Frete - Devoluções',                  '5.3.1.2'),
    ('5.3.1.2.6', 'Frete - Outros Canais',               '5.3.1.2'),
    ('5.3.1.3.1', 'Publicidade Digital (Google, Facebook, TikTok)','5.3.1.3'),
    ('5.3.1.3.2', 'Influenciadores/Afiliados',           '5.3.1.3'),
    ('5.3.1.3.3', 'Email Marketing',                     '5.3.1.3'),
    ('5.3.1.3.4', 'Content Marketing (Blogs, Vídeos)',   '5.3.1.3'),
    ('5.3.1.3.5', 'Publicidade Offline',                 '5.3.1.3'),
    ('5.3.1.3.6', 'Eventos e Feiras',                    '5.3.1.3'),
    ('5.3.1.3.7', 'Materiais Promocionais',              '5.3.1.3'),
    ('5.3.1.3.8', 'Agência de Publicidade',              '5.3.1.3'),
    ('5.3.1.4.1', 'Salários - Atendimento ao Cliente',   '5.3.1.4'),
    ('5.3.1.4.2', 'Encargos - Atendimento ao Cliente',   '5.3.1.4'),
    ('5.3.1.4.3', 'Plataforma de Atendimento (Zendesk)', '5.3.1.4'),
    ('5.3.1.4.4', 'Telefone e Chat',                     '5.3.1.4'),
    ('5.3.1.4.5', 'Ferramentas de CRM',                  '5.3.1.4'),
    ('5.3.1.5.1', 'Salários - Equipe de Vendas',         '5.3.1.5'),
    ('5.3.1.5.2', 'Encargos - Equipe de Vendas',         '5.3.1.5'),
    ('5.3.1.5.3', 'Comissão de Vendas',                  '5.3.1.5'),
    ('5.3.1.5.4', 'Bônus de Vendas',                     '5.3.1.5'),
    ('5.3.1.5.5', 'Viagens - Vendas',                    '5.3.1.5'),
    ('5.3.1.5.6', 'Refeições - Vendas',                  '5.3.1.5'),
    ('5.3.2.1.1', 'Salários - Administrativo',           '5.3.2.1'),
    ('5.3.2.1.2', 'Encargos Sociais - Administrativo',   '5.3.2.1'),
    ('5.3.2.1.3', 'Benefícios - Administrativo',         '5.3.2.1'),
    ('5.3.2.1.4', 'Treinamento e Desenvolvimento',       '5.3.2.1'),
    ('5.3.2.1.5', 'Recrutamento e Seleção',              '5.3.2.1'),
    ('5.3.2.2.1', 'Aluguel - Escritório',                '5.3.2.2'),
    ('5.3.2.2.2', 'Condomínio e Taxas',                  '5.3.2.2'),
    ('5.3.2.2.3', 'Energia Elétrica - Escritório',       '5.3.2.2'),
    ('5.3.2.2.4', 'Água e Esgoto - Escritório',          '5.3.2.2'),
    ('5.3.2.2.5', 'Internet e Telefone',                 '5.3.2.2'),
    ('5.3.2.2.6', 'Limpeza e Higiene',                   '5.3.2.2'),
    ('5.3.2.2.7', 'Segurança',                           '5.3.2.2'),
    ('5.3.2.2.8', 'Manutenção de Escritório',            '5.3.2.2'),
    ('5.3.2.2.9', 'Seguros - Escritório',                '5.3.2.2'),
    ('5.3.2.2.10','Depreciação - Móveis e Equip. Escritório','5.3.2.2'),
    ('5.3.2.3.1', 'Serviços Contábeis e Auditoria',      '5.3.2.3'),
    ('5.3.2.3.2', 'Serviços Jurídicos',                  '5.3.2.3'),
    ('5.3.2.3.3', 'Consultoria',                         '5.3.2.3'),
    ('5.3.2.3.4', 'Licenças e Registros',                '5.3.2.3'),
    ('5.3.2.3.5', 'Despesas Bancárias',                  '5.3.2.3'),
    ('5.3.2.3.6', 'Despesas com Cartório',               '5.3.2.3'),
    ('5.3.2.3.7', 'Multas e Penalidades',                '5.3.2.3'),
    ('5.3.2.3.8', 'Doações e Contribuições',             '5.3.2.3'),
    ('5.3.2.4.1', 'Softwares (Assinaturas SaaS)',        '5.3.2.4'),
    ('5.3.2.4.2', 'Infraestrutura Cloud (AWS, GCP)',     '5.3.2.4'),
    ('5.3.2.4.3', 'Desenvolvimento e Manutenção de Sistemas','5.3.2.4'),
    ('5.3.2.4.4', 'Equipamentos de Informática',         '5.3.2.4'),
    ('5.3.2.4.5', 'Suporte Técnico',                     '5.3.2.4'),
    ('5.3.2.4.6', 'Cibersegurança e Backup',             '5.3.2.4'),
    ('5.3.2.5.1', 'Depreciação - Edifícios',             '5.3.2.5'),
    ('5.3.2.5.2', 'Depreciação - Veículos',              '5.3.2.5'),
    ('5.3.2.5.3', 'Depreciação - Móveis',                '5.3.2.5'),
    ('5.3.2.5.4', 'Amortização - Softwares',             '5.3.2.5'),
    ('5.3.2.5.5', 'Amortização - Marcas e Patentes',     '5.3.2.5'),
    ('5.3.2.5.6', 'Amortização - Goodwill',              '5.3.2.5'),
    ('5.3.3.1.1', 'Juros - Empréstimo Bancário',         '5.3.3.1'),
    ('5.3.3.1.2', 'Juros - Financiamento de Equipamentos','5.3.3.1'),
    ('5.3.3.1.3', 'Juros - Cheque Especial',             '5.3.3.1'),
    ('5.3.3.1.4', 'Juros - Antecipação de Recebíveis',   '5.3.3.1'),
    ('5.3.3.1.5', 'Juros - Leasing',                     '5.3.3.1'),
    ('5.3.3.1.6', 'Juros - Atraso em Pagamentos',        '5.3.3.1'),
    ('5.3.3.2.1', 'Variação Cambial Negativa (Importação)','5.3.3.2'),
    ('5.3.3.2.2', 'Variação Cambial em Empréstimos',     '5.3.3.2'),
    ('5.3.3.3.1', 'IOF (Imposto sobre Operações Financeiras)','5.3.3.3'),
    ('5.3.3.3.2', 'Taxas Bancárias',                     '5.3.3.3'),
    ('5.3.3.3.3', 'Comissão de Crédito',                 '5.3.3.3')
  ) as v(code, name, pcode)
  join chart_accounts_v2 p on p.company_id = p_company_id and p.account_code = v.pcode
  on conflict (company_id, account_code) do nothing;

end;
$$;
