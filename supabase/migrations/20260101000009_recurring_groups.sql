-- Detected recurring charges / subscriptions (Phase 4). See
-- lib/statements/recurring.ts for the detection algorithm; this table
-- stores its output plus the user's confirm/ignore decision and an
-- optional link into the existing Bills feature.

create type public.recurring_frequency as enum ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual');
create type public.recurring_status as enum ('detected', 'confirmed', 'ignored');

create table public.recurring_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  normalized_merchant text not null,
  estimated_amount numeric(12, 2) not null,
  frequency public.recurring_frequency not null,
  next_expected_date date,
  confidence_score numeric(4, 3) not null default 0,
  category_id uuid references public.spending_categories (id) on delete set null,
  status public.recurring_status not null default 'detected',
  linked_bill_id uuid references public.bills (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_profile_id, normalized_merchant)
);
create index recurring_groups_profile_id_idx on public.recurring_groups (budget_profile_id);

create trigger set_updated_at before update on public.recurring_groups
  for each row execute function public.set_updated_at();

alter table public.transactions
  add constraint transactions_recurring_group_fk
  foreign key (recurring_group_id) references public.recurring_groups (id) on delete set null;

alter table public.recurring_groups enable row level security;

create policy "recurring_groups: select own" on public.recurring_groups
  for select using (user_id = auth.uid());
create policy "recurring_groups: insert own" on public.recurring_groups
  for insert with check (user_id = auth.uid());
create policy "recurring_groups: update own" on public.recurring_groups
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recurring_groups: delete own" on public.recurring_groups
  for delete using (user_id = auth.uid());
