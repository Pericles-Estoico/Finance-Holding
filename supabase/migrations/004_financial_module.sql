create table if not exists chart_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  parent_id uuid references chart_accounts(id),
  level integer not null default 1,
  account_type text not null,
  dre_group text,
  ebitda_group text,
  cash_flow_group text,
  affects_dre boolean not null default true,
  affects_ebitda boolean not null default false,
  affects_cash_flow boolean not null default true,
  is_active boolean not null default true,
  company_id uuid references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

alter table chart_accounts enable row level security;
drop policy if exists "users manage their chart_accounts" on chart_accounts;
create policy "users manage their chart_accounts"
  on chart_accounts for all
  using (company_id in (select id from companies where user_id = auth.uid()));

create table if not exists financial_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receivable', 'payable')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  competence_date date not null,
  due_date date not null,
  paid_or_received_date date,
  status text not null default 'open' check (status in ('draft','open','paid','received','overdue','cancelled','partially_paid')),
  chart_account_id uuid not null references chart_accounts(id),
  cost_center_id uuid,
  channel text,
  company_id uuid references companies(id) on delete cascade,
  counterparty text,
  document_number text,
  payment_method text,
  installment_number integer,
  total_installments integer,
  parent_entry_id uuid references financial_entries(id),
  is_recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('weekly','biweekly','monthly','yearly')),
  recurrence_end_date date,
  bank_account_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table financial_entries enable row level security;
drop policy if exists "users manage their financial_entries" on financial_entries;
create policy "users manage their financial_entries"
  on financial_entries for all
  using (company_id in (select id from companies where user_id = auth.uid()));

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  bank_name text,
  initial_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bank_accounts enable row level security;
drop policy if exists "users manage their bank_accounts" on bank_accounts;
create policy "users manage their bank_accounts"
  on bank_accounts for all
  using (company_id in (select id from companies where user_id = auth.uid()));

create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cost_centers enable row level security;
drop policy if exists "users manage their cost_centers" on cost_centers;
create policy "users manage their cost_centers"
  on cost_centers for all
  using (company_id in (select id from companies where user_id = auth.uid()));

create or replace function seed_default_chart_accounts(p_company_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_accounts (company_id, code, name, level, account_type, dre_group, ebitda_group, cash_flow_group, affects_dre, affects_ebitda, affects_cash_flow) values
  (p_company_id,'1','Receitas',1,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.1','Receita Shopee',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.2','Receita Mercado Livre',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.3','Receita Shein',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.4','Receita Loja Própria',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.5','Receita Atacado',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'1.6','Receita Outros Canais',2,'gross_revenue','gross_revenue','net_revenue','operating_inflow',true,true,true),
  (p_company_id,'2','Deduções da Receita',1,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'2.1','Cancelamentos',2,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'2.2','Devoluções',2,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'2.3','Descontos Comerciais',2,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'2.4','Cupons',2,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'2.5','Impostos sobre Venda',2,'revenue_deduction','revenue_deductions','net_revenue','tax_outflow',true,true,true),
  (p_company_id,'2.6','Taxas de Marketplace',2,'revenue_deduction','revenue_deductions','net_revenue','operating_outflow',true,true,true),
  (p_company_id,'3','Custos dos Produtos Vendidos',1,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.1','Tecido',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.2','Aviamentos',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.3','Embalagem do Produto',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.4','Costura Interna',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.5','Costura Externa',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.6','Bordado',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.7','Mão de Obra Direta',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'3.8','Perdas de Produção',2,'cogs','cogs','cogs','operating_outflow',true,true,true),
  (p_company_id,'4','Despesas Comerciais',1,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'4.1','Comissão Marketplace',2,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'4.2','Frete Subsidiado',2,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'4.3','Tráfego Pago',2,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'4.4','Influenciadores',2,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'4.5','Fotos e Criativos',2,'commercial_expense','commercial_expenses','commercial_expenses','operating_outflow',true,true,true),
  (p_company_id,'5','Despesas Administrativas',1,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'5.1','Salários Administrativos',2,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'5.2','Pró-labore',2,'administrative_expense','administrative_expenses','administrative_expenses','owner_withdrawal',true,true,true),
  (p_company_id,'5.3','Contabilidade',2,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'5.4','Sistemas',2,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'5.5','Internet',2,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'5.6','Aluguel',2,'administrative_expense','administrative_expenses','administrative_expenses','operating_outflow',true,true,true),
  (p_company_id,'6','Despesas Operacionais',1,'operational_expense','operational_expenses','operational_expenses','operating_outflow',true,true,true),
  (p_company_id,'6.1','Energia Produção',2,'operational_expense','operational_expenses','operational_expenses','operating_outflow',true,true,true),
  (p_company_id,'6.2','Manutenção de Máquinas',2,'operational_expense','operational_expenses','operational_expenses','operating_outflow',true,true,true),
  (p_company_id,'6.3','EPIs',2,'operational_expense','operational_expenses','operational_expenses','operating_outflow',true,true,true),
  (p_company_id,'6.4','Limpeza',2,'operational_expense','operational_expenses','operational_expenses','operating_outflow',true,true,true),
  (p_company_id,'7','Depreciação e Amortização',1,'depreciation','depreciation_amortization','excluded_from_ebitda',null,true,false,false),
  (p_company_id,'7.1','Depreciação Máquinas',2,'depreciation','depreciation_amortization','excluded_from_ebitda',null,true,false,false),
  (p_company_id,'7.2','Depreciação Equipamentos',2,'depreciation','depreciation_amortization','excluded_from_ebitda',null,true,false,false),
  (p_company_id,'7.3','Amortização Sistemas',2,'amortization','depreciation_amortization','excluded_from_ebitda',null,true,false,false),
  (p_company_id,'8','Resultado Financeiro',1,'financial_expense','financial_result','excluded_from_ebitda','financing_outflow',true,false,true),
  (p_company_id,'8.1','Juros Recebidos',2,'financial_income','financial_result','excluded_from_ebitda','financing_inflow',true,false,true),
  (p_company_id,'8.2','Juros Pagos',2,'financial_expense','financial_result','excluded_from_ebitda','financing_outflow',true,false,true),
  (p_company_id,'8.3','Tarifas Bancárias',2,'financial_expense','financial_result','excluded_from_ebitda','financing_outflow',true,false,true),
  (p_company_id,'8.4','Multas',2,'financial_expense','financial_result','excluded_from_ebitda','financing_outflow',true,false,true),
  (p_company_id,'8.5','Encargos de Empréstimos',2,'financial_expense','financial_result','excluded_from_ebitda','financing_outflow',true,false,true),
  (p_company_id,'9','Impostos sobre Lucro',1,'tax_on_profit','taxes_on_profit','excluded_from_ebitda','tax_outflow',true,false,true),
  (p_company_id,'9.1','IRPJ',2,'tax_on_profit','taxes_on_profit','excluded_from_ebitda','tax_outflow',true,false,true),
  (p_company_id,'9.2','CSLL',2,'tax_on_profit','taxes_on_profit','excluded_from_ebitda','tax_outflow',true,false,true),
  (p_company_id,'10','Investimentos',1,'investment',null,'excluded_from_ebitda','investment_outflow',false,false,true),
  (p_company_id,'10.1','Compra de Máquina',2,'investment',null,'excluded_from_ebitda','investment_outflow',false,false,true),
  (p_company_id,'10.2','Compra de Equipamento',2,'investment',null,'excluded_from_ebitda','investment_outflow',false,false,true),
  (p_company_id,'10.3','Reforma',2,'investment',null,'excluded_from_ebitda','investment_outflow',false,false,true),
  (p_company_id,'11','Movimentações de Sócios',1,'equity',null,'excluded_from_ebitda','owner_withdrawal',false,false,true),
  (p_company_id,'11.1','Aporte de Sócio',2,'equity',null,'excluded_from_ebitda','capital_injection',false,false,true),
  (p_company_id,'11.2','Distribuição de Lucro',2,'equity',null,'excluded_from_ebitda','owner_withdrawal',false,false,true),
  (p_company_id,'11.3','Retirada Extraordinária',2,'equity',null,'excluded_from_ebitda','owner_withdrawal',false,false,true)
  on conflict (company_id, code) do nothing;
end;
$$;
