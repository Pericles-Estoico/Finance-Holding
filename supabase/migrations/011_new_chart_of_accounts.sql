-- Migration 011: Plano de Contas Gerencial - Fábrica de Roupas/E-commerce
-- Substitui chart_accounts_v2 por estrutura DRE-aligned com 6 grupos
-- Story 6.1

BEGIN;

-- Desvincula transações antes de apagar contas antigas:
-- 1. Remove check constraint temporariamente
-- 2. Remove FK temporariamente
-- 3. Limpa referências
-- 4. Restaura FK e check constraint

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_has_account;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_chart_account_v2_id_fkey;

UPDATE public.transactions
  SET chart_account_v2_id = NULL
  WHERE chart_account_v2_id IN (
    SELECT id FROM chart_accounts_v2 WHERE company_id = 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51'
  );

DELETE FROM chart_accounts_v2 WHERE company_id = 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51';

INSERT INTO chart_accounts_v2
  (account_code, account_name, account_class, account_type, normal_balance, level, is_calculated, is_active, company_id, description, parent_account_id, created_by)
VALUES
-- ══════════════════════════════════════════
-- GRUPO 1: RECEITAS (REVENUE)
-- ══════════════════════════════════════════
('1',     'RECEITAS',                                  'REVENUE', 'receita',             'credit', 1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.1',   'Receitas Operacionais Brutas',              'REVENUE', 'receita',             'credit', 2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.1.1', 'Vendas em Marketplaces',                    'REVENUE', 'receita',             'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Mercado Livre, Shopee, Amazon, etc.', null, null),
('1.1.2', 'Vendas em E-commerce Próprio',              'REVENUE', 'receita',             'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.1.3', 'Vendas Atacado / B2B',                      'REVENUE', 'receita',             'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Lojistas', null, null),
('1.1.4', 'Vendas Varejo',                             'REVENUE', 'receita',             'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Físico/WhatsApp', null, null),
('1.1.5', 'Receitas com Fretes Cobrados dos Clientes', 'REVENUE', 'receita',             'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.2',   'Deduções da Receita Bruta',                 'REVENUE', 'deducao',             'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.2.1', 'Devoluções e Cancelamentos de Vendas',      'REVENUE', 'deducao',             'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.2.2', 'Impostos sobre Vendas',                     'REVENUE', 'deducao',             'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Simples Nacional, ICMS, PIS, COFINS', null, null),
('1.2.3', 'Taxas e Comissões de Marketplaces',         'REVENUE', 'deducao',             'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.2.4', 'Taxas de Meios de Pagamento',               'REVENUE', 'deducao',             'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Cartão, Boleto, Pix, Gateway', null, null),
('1.3',   'Receitas Não Operacionais',                 'REVENUE', 'receita_nao_op',      'credit', 2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.3.1', 'Rendimentos de Aplicações Financeiras',     'REVENUE', 'receita_nao_op',      'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('1.3.2', 'Venda de Ativos',                           'REVENUE', 'receita_nao_op',      'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Máquinas, equipamentos usados', null, null),
('1.3.3', 'Outras Receitas',                           'REVENUE', 'receita_nao_op',      'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),

-- ══════════════════════════════════════════
-- GRUPO 2: CUSTOS VARIÁVEIS / CPV (EXPENSE)
-- ══════════════════════════════════════════
('2',     'CUSTOS VARIÁVEIS (CPV)',                    'EXPENSE', 'cpv',                 'debit',  1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.1',   'Matéria-Prima e Insumos',                   'EXPENSE', 'cpv',                 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.1.1', 'Tecidos e Malhas',                          'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.1.2', 'Aviamentos',                                'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Linhas, botões, zíperes, elásticos', null, null),
('2.1.3', 'Etiquetas',                                 'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Composição, marca, tamanho', null, null),
('2.2',   'Mão de Obra Direta e Terceirizada',         'EXPENSE', 'cpv',                 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.2.1', 'Facções / Costureiras Terceirizadas',       'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.2.2', 'Serviços de Corte',                         'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.2.3', 'Serviços de Estamparia / Bordado',          'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.3',   'Embalagens e Logística de Envio',           'EXPENSE', 'cpv',                 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.3.1', 'Caixas e Envelopes de Segurança',           'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'E-commerce', null, null),
('2.3.2', 'Fitas, Plástico Bolha e Papel Seda',        'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('2.3.3', 'Fretes de Envio',                           'EXPENSE', 'cpv',                 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Correios, Transportadoras', null, null),

-- ══════════════════════════════════════════
-- GRUPO 3: DESPESAS OPERACIONAIS (EXPENSE)
-- ══════════════════════════════════════════
('3',     'DESPESAS OPERACIONAIS',                     'EXPENSE', 'despesa_operacional', 'debit',  1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.1',   'Despesas com Pessoal',                      'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.1.1', 'Salários',                                  'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Administrativo, Vendas, Estoque', null, null),
('3.1.2', 'Encargos Sociais',                          'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'INSS, FGTS', null, null),
('3.1.3', 'Benefícios',                                'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Vale Transporte, Vale Refeição', null, null),
('3.1.4', 'Férias e 13º Salário',                      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.1.5', 'Prêmios, Bonificações e Gamificação',       'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.2',   'Pró-Labore',                                'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.2.1', 'Pró-Labore dos Sócios',                     'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.2.2', 'INSS sobre Pró-Labore',                     'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3',   'Acertos Trabalhistas',                      'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.1', 'Rescisões Contratuais',                     'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.2', 'Multa FGTS (40%)',                          'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.3', 'Exames Ocupacionais',                       'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.4', 'Acordos Trabalhistas Extrajudiciais',       'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.5', 'Processos Judiciais Trabalhistas',          'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.3.6', 'Honorários Advocatícios Trabalhistas',      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4',   'Despesas Administrativas e Ocupação',       'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.1', 'Aluguel e Condomínio',                      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.2', 'Energia Elétrica e Água',                   'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.3', 'Internet e Telefonia',                      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.4', 'Material de Escritório e Limpeza',          'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.5', 'Manutenção de Equipamentos',                'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.4.6', 'Seguros',                                   'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.5',   'Serviços Profissionais Terceirizados',      'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.5.1', 'Honorários Contábeis',                      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.5.2', 'Honorários Advocatícios',                   'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.5.3', 'Consultorias',                              'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.6',   'Marketing e Vendas',                        'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.6.1', 'Tráfego Pago',                              'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Meta Ads, Google Ads', null, null),
('3.6.2', 'Campanhas de Marketplaces',                 'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Ads Shopee, Mercado Ads', null, null),
('3.6.3', 'Ferramentas de Marketing',                  'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'E-mail Marketing', null, null),
('3.6.4', 'Produção de Conteúdo',                      'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Fotos, vídeos, modelos', null, null),
('3.6.5', 'Brindes para Clientes',                     'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.7',   'Tecnologia e Softwares',                    'EXPENSE', 'despesa_operacional', 'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.7.1', 'Plataforma de E-commerce',                  'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.7.2', 'ERP / Sistema de Gestão',                   'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Bling, Tiny, etc.', null, null),
('3.7.3', 'Hub de Integração de Marketplaces',         'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('3.7.4', 'Hospedagem de Site e Domínios',             'EXPENSE', 'despesa_operacional', 'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),

-- ══════════════════════════════════════════
-- GRUPO 4: DESPESAS FINANCEIRAS (EXPENSE)
-- ══════════════════════════════════════════
('4',     'DESPESAS FINANCEIRAS',                      'EXPENSE', 'despesa_financeira',  'debit',  1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.1',   'Despesas Bancárias',                        'EXPENSE', 'despesa_financeira',  'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.1.1', 'Tarifas de Manutenção de Conta',            'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.1.2', 'Taxas de Transferência (TED/DOC)',           'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.1.3', 'Juros e Multas por Atraso',                 'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.2',   'Parcelas de Dívidas',                       'EXPENSE', 'despesa_financeira',  'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.2.1', 'Amortização de Empréstimos Bancários',      'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.2.2', 'Juros sobre Empréstimos',                   'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('4.2.3', 'Parcelamento de Impostos',                  'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Simples, INSS, etc.', null, null),
('4.2.4', 'Antecipação de Recebíveis',                 'EXPENSE', 'despesa_financeira',  'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Taxas de desconto', null, null),

-- ══════════════════════════════════════════
-- GRUPO 5: INVESTIMENTOS (ASSET) — Não entra no DRE
-- ══════════════════════════════════════════
('5',     'INVESTIMENTOS',                             'ASSET',   'investimento',        'debit',  1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Não afeta o resultado do DRE', null, null),
('5.1',   'Imobilizado e Equipamentos',                'ASSET',   'investimento',        'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.1.1', 'Máquinas de Costura e Corte',              'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.1.2', 'Computadores e Eletrônicos',                'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.1.3', 'Móveis e Instalações',                      'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.2',   'Investimentos Intangíveis',                 'ASSET',   'investimento',        'debit',  2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.2.1', 'Registro de Marca (INPI)',                  'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.2.2', 'Desenvolvimento de Novo Site/App',          'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('5.2.3', 'Cursos e Treinamentos',                     'ASSET',   'investimento',        'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),

-- ══════════════════════════════════════════
-- GRUPO 6: MOVIMENTAÇÕES NÃO OPERACIONAIS (EQUITY) — Não entra no DRE
-- ══════════════════════════════════════════
('6',     'MOVIMENTAÇÕES NÃO OPERACIONAIS',            'EQUITY',  'nao_operacional',     'credit', 1, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', 'Não afeta o resultado do DRE', null, null),
('6.1',   'Aportes e Distribuição',                    'EQUITY',  'nao_operacional',     'credit', 2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('6.1.1', 'Aporte de Capital dos Sócios',              'EQUITY',  'nao_operacional',     'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('6.1.2', 'Distribuição de Lucros',                    'EQUITY',  'nao_operacional',     'debit',  3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('6.2',   'Transferências',                            'EQUITY',  'nao_operacional',     'credit', 2, true,  true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('6.2.1', 'Transferência entre Contas Correntes',      'EQUITY',  'nao_operacional',     'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null),
('6.2.2', 'Transferência para Aplicação Financeira',   'EQUITY',  'nao_operacional',     'credit', 3, false, true, 'a4e864f8-f63d-4a51-af5f-0fa2eb91aa51', null, null, null);

-- Restaura FK após reconstrução do plano de contas
-- (check constraint chk_transactions_has_account não é restaurada pois há
--  transações sem account_id nem chart_account_v2_id — o fallback por type já trata isso)
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_chart_account_v2_id_fkey
  FOREIGN KEY (chart_account_v2_id)
  REFERENCES public.chart_accounts_v2(id)
  ON DELETE RESTRICT;

COMMIT;
