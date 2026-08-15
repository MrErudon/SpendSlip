-- Statement import & transaction ledger schema (Phase 1).
-- financial_accounts, spending_categories, statement_imports, transactions.
-- merchant_rules and recurring_groups follow in later migrations
-- (Phase 2 / Phase 4) per the phased rollout in
-- docs/statement-import-expansion-plan.md.

create type public.account_type as enum ('checking', 'savings', 'credit_card', 'loan', 'cash', 'other');
create type public.statement_source_type as enum ('csv', 'pdf');
create type public.import_status as enum ('processing', 'review', 'completed', 'failed');
create type public.transaction_direction as enum ('inflow', 'outflow');
create type public.transaction_type as enum (
  'purchase', 'income', 'transfer', 'credit_card_payment', 'loan_payment',
  'refund', 'reimbursement', 'cash_withdrawal', 'fee', 'interest', 'other'
);
create type public.spending_tag as enum ('fixed', 'variable_essential', 'discretionary', 'savings', 'debt');

-- ---------------------------------------------------------------------
-- financial_accounts
-- ---------------------------------------------------------------------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  institution_name text,
  account_name text not null,
  account_type public.account_type not null default 'checking',
  last_four text,
  currency text not null default 'USD',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index financial_accounts_profile_id_idx on public.financial_accounts (budget_profile_id);
create index financial_accounts_user_id_idx on public.financial_accounts (user_id);

-- ---------------------------------------------------------------------
-- spending_categories (distinct from bill_categories: these classify
-- arbitrary transactions, not just recurring bills)
-- ---------------------------------------------------------------------
create table public.spending_categories (
  id uuid primary key default gen_random_uuid(),
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  name text not null,
  emoji text not null default '🗂️',
  spending_tag public.spending_tag,
  budget_amount numeric(12, 2),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_profile_id, name)
);
create index spending_categories_profile_id_idx on public.spending_categories (budget_profile_id);

-- ---------------------------------------------------------------------
-- statement_imports
-- ---------------------------------------------------------------------
create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts (id) on delete cascade,
  filename text not null,
  source_type public.statement_source_type not null,
  detected_provider text,
  statement_start_date date,
  statement_end_date date,
  transaction_count integer not null default 0,
  import_status public.import_status not null default 'processing',
  original_file_path text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index statement_imports_profile_id_idx on public.statement_imports (budget_profile_id);
create index statement_imports_account_id_idx on public.statement_imports (financial_account_id);

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts (id) on delete cascade,
  statement_import_id uuid references public.statement_imports (id) on delete set null,
  transaction_date date not null,
  posted_date date,
  raw_description text not null,
  normalized_merchant text not null,
  amount numeric(12, 2) not null,
  direction public.transaction_direction not null,
  transaction_type public.transaction_type not null default 'purchase',
  category_id uuid references public.spending_categories (id) on delete set null,
  is_recurring boolean not null default false,
  recurring_group_id uuid,
  is_transfer boolean not null default false,
  is_credit_card_payment boolean not null default false,
  is_refund boolean not null default false,
  is_reimbursement boolean not null default false,
  is_income boolean not null default false,
  is_excluded boolean not null default false,
  needs_review boolean not null default false,
  fingerprint text not null,
  user_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_profile_id_idx on public.transactions (budget_profile_id);
create index transactions_date_idx on public.transactions (transaction_date);
create index transactions_merchant_idx on public.transactions (normalized_merchant);
create index transactions_fingerprint_idx on public.transactions (fingerprint);
create index transactions_account_id_idx on public.transactions (financial_account_id);
create index transactions_import_id_idx on public.transactions (statement_import_id);

-- ---------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at from an earlier migration)
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.financial_accounts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.spending_categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.statement_imports
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Seed the standard spending category set for every new budget profile
-- (covers both the signup-bootstrapped "Personal" profile and any
-- profile a user creates later from the UI).
-- ---------------------------------------------------------------------
create or replace function public.seed_spending_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.spending_categories (budget_profile_id, name, emoji, spending_tag, sort_order) values
    (new.id, 'Housing', '🏠', 'fixed', 0),
    (new.id, 'Utilities', '💡', 'fixed', 1),
    (new.id, 'Groceries', '🛒', 'variable_essential', 2),
    (new.id, 'Dining', '🍽️', 'discretionary', 3),
    (new.id, 'Transportation', '🚌', 'variable_essential', 4),
    (new.id, 'Gas', '⛽', 'variable_essential', 5),
    (new.id, 'Shopping', '🛍️', 'discretionary', 6),
    (new.id, 'Entertainment', '🎬', 'discretionary', 7),
    (new.id, 'Subscriptions', '🔁', 'fixed', 8),
    (new.id, 'Health', '🏥', 'variable_essential', 9),
    (new.id, 'Fitness', '💪', 'discretionary', 10),
    (new.id, 'Travel', '✈️', 'discretionary', 11),
    (new.id, 'Personal Care', '💇', 'discretionary', 12),
    (new.id, 'Education', '🎓', 'variable_essential', 13),
    (new.id, 'Debt', '💳', 'debt', 14),
    (new.id, 'Insurance', '🛡️', 'fixed', 15),
    (new.id, 'Pets', '🐾', 'variable_essential', 16),
    (new.id, 'Gifts', '🎁', 'discretionary', 17),
    (new.id, 'Cash', '💵', 'discretionary', 18),
    (new.id, 'Fees', '⚠️', 'discretionary', 19),
    (new.id, 'Income', '💰', null, 20),
    (new.id, 'Transfers', '🔄', null, 21),
    (new.id, 'Other', '📦', null, 22);
  return new;
end;
$$;

create trigger on_budget_profile_created_seed_categories
  after insert on public.budget_profiles
  for each row execute function public.seed_spending_categories();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.financial_accounts enable row level security;
alter table public.spending_categories enable row level security;
alter table public.statement_imports enable row level security;
alter table public.transactions enable row level security;

create policy "financial_accounts: select own" on public.financial_accounts
  for select using (user_id = auth.uid());
create policy "financial_accounts: insert own" on public.financial_accounts
  for insert with check (user_id = auth.uid());
create policy "financial_accounts: update own" on public.financial_accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "financial_accounts: delete own" on public.financial_accounts
  for delete using (user_id = auth.uid());

create policy "spending_categories: select own" on public.spending_categories
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = budget_profile_id and p.user_id = auth.uid())
  );
create policy "spending_categories: insert own" on public.spending_categories
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = budget_profile_id and p.user_id = auth.uid())
  );
create policy "spending_categories: update own" on public.spending_categories
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = budget_profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = budget_profile_id and p.user_id = auth.uid())
  );
create policy "spending_categories: delete own" on public.spending_categories
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = budget_profile_id and p.user_id = auth.uid())
  );

create policy "statement_imports: select own" on public.statement_imports
  for select using (user_id = auth.uid());
create policy "statement_imports: insert own" on public.statement_imports
  for insert with check (user_id = auth.uid());
create policy "statement_imports: update own" on public.statement_imports
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "statement_imports: delete own" on public.statement_imports
  for delete using (user_id = auth.uid());

create policy "transactions: select own" on public.transactions
  for select using (user_id = auth.uid());
create policy "transactions: insert own" on public.transactions
  for insert with check (user_id = auth.uid());
create policy "transactions: update own" on public.transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions: delete own" on public.transactions
  for delete using (user_id = auth.uid());
