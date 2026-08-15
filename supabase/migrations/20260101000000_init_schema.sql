-- SpendSlip initial schema
-- Tables, constraints, and indexes. RLS policies live in
-- 20260101000001_rls_policies.sql; triggers/functions in
-- 20260101000002_functions_triggers.sql; seed data in
-- 20260101000003_seed_tax_brackets.sql.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- budget_profiles
-- ---------------------------------------------------------------------
create table public.budget_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🏠',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index budget_profiles_user_id_idx on public.budget_profiles (user_id);

-- ---------------------------------------------------------------------
-- bill_categories
-- ---------------------------------------------------------------------
create table public.bill_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bill_categories_profile_id_idx on public.bill_categories (profile_id);

-- ---------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------
create type public.bill_recurrence as enum ('monthly', 'biweekly', 'weekly', 'annual');

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  category_id uuid not null references public.bill_categories (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  payment_url text,
  recurrence public.bill_recurrence not null default 'monthly',
  autopay boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bills_profile_id_idx on public.bills (profile_id);
create index bills_category_id_idx on public.bills (category_id);

-- ---------------------------------------------------------------------
-- bill_occurrences (one row per billing period, drives paid/due status)
-- ---------------------------------------------------------------------
create table public.bill_occurrences (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  due_date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  -- Idempotency key for rollover, e.g. "2026-08" (monthly) or the ISO due
  -- date itself for weekly/biweekly bills.
  period_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, period_key)
);
create index bill_occurrences_profile_id_idx on public.bill_occurrences (profile_id);
create index bill_occurrences_bill_id_idx on public.bill_occurrences (bill_id);
create index bill_occurrences_due_date_idx on public.bill_occurrences (due_date);

-- ---------------------------------------------------------------------
-- income_settings (one row per profile)
-- ---------------------------------------------------------------------
create type public.income_mode as enum ('hourly', 'salary');
create type public.filing_status as enum ('single', 'married_joint', 'married_separate', 'head_of_household');

create table public.income_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.budget_profiles (id) on delete cascade,
  mode public.income_mode not null default 'hourly',
  hourly_rate numeric(10, 2),
  hours_per_week numeric(6, 2),
  annual_salary numeric(12, 2),
  manual_ot_rate numeric(10, 2),
  additional_income numeric(12, 2) not null default 0,
  filing_status public.filing_status not null default 'single',
  state_rate numeric(6, 4) not null default 0,
  flat_rate_override numeric(6, 4),
  savings_goal numeric(12, 2) not null default 0,
  hours_worked_this_period numeric(6, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- paychecks
-- ---------------------------------------------------------------------
create table public.paychecks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  label text,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index paychecks_profile_id_idx on public.paychecks (profile_id);
create index paychecks_date_idx on public.paychecks (date);

-- ---------------------------------------------------------------------
-- bill_paycheck_allocations (assignment of a bill to a paycheck)
-- ---------------------------------------------------------------------
create table public.bill_paycheck_allocations (
  id uuid primary key default gen_random_uuid(),
  paycheck_id uuid not null references public.paychecks (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  occurrence_id uuid references public.bill_occurrences (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (paycheck_id, bill_id)
);
create index bill_paycheck_allocations_paycheck_id_idx on public.bill_paycheck_allocations (paycheck_id);
create index bill_paycheck_allocations_bill_id_idx on public.bill_paycheck_allocations (bill_id);

-- ---------------------------------------------------------------------
-- shared_budgets
-- ---------------------------------------------------------------------
create table public.shared_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🤝',
  goal_label text,
  goal_amount numeric(12, 2),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_budgets_owner_id_idx on public.shared_budgets (owner_id);

-- ---------------------------------------------------------------------
-- shared_budget_members
-- ---------------------------------------------------------------------
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.invite_status as enum ('pending', 'accepted', 'declined');

create table public.shared_budget_members (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.shared_budgets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email citext not null,
  role public.member_role not null default 'editor',
  status public.invite_status not null default 'pending',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, email)
);
create index shared_budget_members_budget_id_idx on public.shared_budget_members (budget_id);
create index shared_budget_members_user_id_idx on public.shared_budget_members (user_id);

-- ---------------------------------------------------------------------
-- shared_budget_income (each member's own private-entry, shared-visible income)
-- ---------------------------------------------------------------------
create table public.shared_budget_income (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.shared_budgets (id) on delete cascade,
  member_id uuid not null unique references public.shared_budget_members (id) on delete cascade,
  net_monthly_income numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);
create index shared_budget_income_budget_id_idx on public.shared_budget_income (budget_id);

-- ---------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.shared_budgets (id) on delete cascade,
  member_id uuid not null references public.shared_budget_members (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);
create index goal_contributions_budget_id_idx on public.goal_contributions (budget_id);
create index goal_contributions_member_id_idx on public.goal_contributions (member_id);

-- ---------------------------------------------------------------------
-- notification_settings (one row per user)
-- ---------------------------------------------------------------------
create table public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email_reminders boolean not null default true,
  reminder_days integer[] not null default '{1,3,7}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- tax_brackets (global reference data, not user-owned)
-- ---------------------------------------------------------------------
create table public.tax_brackets (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  filing_status public.filing_status not null,
  bracket_order smallint not null,
  min_income numeric(12, 2) not null,
  max_income numeric(12, 2),
  rate numeric(6, 4) not null,
  unique (year, filing_status, bracket_order)
);
