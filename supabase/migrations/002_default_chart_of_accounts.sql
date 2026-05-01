-- ============================================================
-- Função: insere plano de contas padrão para manufatura/varejo
-- Chamada automaticamente ao criar uma empresa
-- ============================================================
create or replace function public.seed_default_chart_of_accounts(p_company_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.chart_of_accounts (company_id, code, name, type, is_system) values
    -- RECEITAS
    (p_company_id, '1',     'Receitas',                        'receita', true),
    (p_company_id, '1.1',   'Receita de Vendas - Amazon',      'receita', true),
    (p_company_id, '1.2',   'Receita de Vendas - Shopify',     'receita', true),
    (p_company_id, '1.3',   'Receita de Vendas - Varejo Físico','receita', true),
    (p_company_id, '1.4',   'Receita de Vendas - B2B',         'receita', true),
    (p_company_id, '1.5',   'Receita de Vendas - Mercado Livre','receita', true),
    (p_company_id, '1.9',   'Outras Receitas',                 'receita', true),
    (p_company_id, '1.0',   'Deduções da Receita',             'receita', true),
    (p_company_id, '1.0.1', 'Devoluções',                      'receita', true),
    (p_company_id, '1.0.2', 'Descontos Concedidos',            'receita', true),
    -- CMV
    (p_company_id, '2',     'CMV - Custo das Mercadorias Vendidas', 'cmv', true),
    (p_company_id, '2.1',   'Matéria Prima',                   'cmv', true),
    (p_company_id, '2.2',   'Mão de Obra Direta',              'cmv', true),
    (p_company_id, '2.3',   'Embalagem',                       'cmv', true),
    (p_company_id, '2.4',   'Frete de Entrada (Landed Cost)',  'cmv', true),
    (p_company_id, '2.5',   'Taxas de Marketplace',            'cmv', true),
    (p_company_id, '2.6',   'Frete de Saída (Fulfillment)',    'cmv', true),
    -- DESPESAS OPERACIONAIS
    (p_company_id, '3',     'Despesas Operacionais',           'despesa_operacional', true),
    (p_company_id, '3.1',   'Despesas Comerciais',             'despesa_operacional', true),
    (p_company_id, '3.1.1', 'Marketing e Publicidade',         'despesa_operacional', true),
    (p_company_id, '3.1.2', 'Comissões de Vendas',             'despesa_operacional', true),
    (p_company_id, '3.2',   'Despesas Administrativas',        'despesa_operacional', true),
    (p_company_id, '3.2.1', 'Salários Administrativos',        'despesa_operacional', true),
    (p_company_id, '3.2.2', 'Aluguel',                         'despesa_operacional', true),
    (p_company_id, '3.2.3', 'Serviços Contábeis',              'despesa_operacional', true),
    (p_company_id, '3.2.4', 'Software e Ferramentas',          'despesa_operacional', true),
    (p_company_id, '3.3',   'Despesas Financeiras',            'despesa_operacional', true),
    (p_company_id, '3.3.1', 'Juros e Encargos',                'despesa_operacional', true),
    (p_company_id, '3.3.2', 'Tarifas Bancárias',               'despesa_operacional', true),
    (p_company_id, '3.4',   'Logística',                       'despesa_operacional', true),
    (p_company_id, '3.4.1', 'Frete de Entrega ao Cliente',     'despesa_operacional', true),
    (p_company_id, '3.4.2', 'Armazenagem',                     'despesa_operacional', true),
    -- IMPOSTOS
    (p_company_id, '4',     'Impostos',                        'imposto', true),
    (p_company_id, '4.1',   'Simples Nacional',                'imposto', true),
    (p_company_id, '4.2',   'ICMS',                            'imposto', true),
    (p_company_id, '4.3',   'PIS / COFINS',                    'imposto', true),
    (p_company_id, '4.4',   'IRPJ / CSLL',                     'imposto', true)
  on conflict (company_id, code) do nothing;
end;
$$;
