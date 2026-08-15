-- User-authored merchant normalization/categorization overrides. Checked
-- before built-in keyword rules and AI classification on every import
-- (see lib/statements/categorize.ts).

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_profile_id uuid not null references public.budget_profiles (id) on delete cascade,
  merchant_pattern text not null, -- matched case-insensitively against normalized_merchant
  normalized_merchant text,
  category_id uuid references public.spending_categories (id) on delete set null,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_profile_id, merchant_pattern)
);
create index merchant_rules_profile_id_idx on public.merchant_rules (budget_profile_id);

create trigger set_updated_at before update on public.merchant_rules
  for each row execute function public.set_updated_at();

alter table public.merchant_rules enable row level security;

create policy "merchant_rules: select own" on public.merchant_rules
  for select using (user_id = auth.uid());
create policy "merchant_rules: insert own" on public.merchant_rules
  for insert with check (user_id = auth.uid());
create policy "merchant_rules: update own" on public.merchant_rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "merchant_rules: delete own" on public.merchant_rules
  for delete using (user_id = auth.uid());
