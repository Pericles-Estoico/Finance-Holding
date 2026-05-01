-- Drive Import Automation Tables

-- Folder config per company
create table if not exists drive_import_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  folder_id text not null,
  folder_url text,
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz default now(),
  unique(company_id)
);

alter table drive_import_configs enable row level security;
create policy "users manage their drive configs"
  on drive_import_configs for all
  using (company_id in (select id from companies where user_id = auth.uid()));

-- Dedup: tracks which Drive file IDs have been processed
create table if not exists drive_processed_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  company_id uuid not null references companies(id) on delete cascade,
  file_name text,
  file_url text,
  transaction_id uuid references transactions(id) on delete set null,
  status text not null default 'done' check (status in ('done', 'pending', 'error')),
  ocr_data jsonb,
  created_at timestamptz default now(),
  unique(drive_file_id, company_id)
);

alter table drive_processed_files enable row level security;
create policy "users manage their processed files"
  on drive_processed_files for all
  using (company_id in (select id from companies where user_id = auth.uid()));

-- Payee → Account memory (learns which account to use per supplier)
create table if not exists payee_account_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payee_name text not null,
  account_id uuid not null references chart_of_accounts(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('receita', 'despesa')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, payee_name)
);

alter table payee_account_rules enable row level security;
create policy "users manage their payee rules"
  on payee_account_rules for all
  using (company_id in (select id from companies where user_id = auth.uid()));

-- Queue of receipts awaiting manual account assignment
create table if not exists pending_classifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  drive_file_id text not null,
  file_name text,
  file_url text,
  extracted_data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz default now()
);

alter table pending_classifications enable row level security;
create policy "users manage their pending classifications"
  on pending_classifications for all
  using (company_id in (select id from companies where user_id = auth.uid()));
