-- Shared functions and triggers: updated_at maintenance, default profile
-- bootstrap on signup, and shared-budget helper functions used by RLS.

-- ---------------------------------------------------------------------
-- updated_at trigger, applied to every table with an updated_at column
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'budget_profiles', 'bill_categories', 'bills', 'bill_occurrences',
    'income_settings', 'paychecks', 'shared_budgets', 'shared_budget_members',
    'notification_settings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- shared_budget_income uses updated_at directly (no created_at counterpart needed beyond default)
create trigger set_updated_at
  before update on public.shared_budget_income
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- New user bootstrap: default "Personal" profile + starter categories
-- + notification settings row.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_profile_id uuid;
begin
  insert into public.budget_profiles (user_id, name, emoji, is_default, sort_order)
  values (new.id, 'Personal', '🏠', true, 0)
  returning id into new_profile_id;

  insert into public.bill_categories (profile_id, name, sort_order)
  values
    (new_profile_id, 'Bills', 0),
    (new_profile_id, 'Credit Cards', 1),
    (new_profile_id, 'Loans', 2),
    (new_profile_id, 'Subscriptions', 3);

  insert into public.income_settings (profile_id)
  values (new_profile_id);

  insert into public.notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- When a user accepts a pending invite (or otherwise gets linked to a
-- shared_budget_members row by email at signup), sync user_id.
-- ---------------------------------------------------------------------
create or replace function public.link_pending_invites()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.shared_budget_members
  set user_id = new.id
  where email = new.email and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created_link_invites
  after insert on auth.users
  for each row execute function public.link_pending_invites();

-- ---------------------------------------------------------------------
-- Shared-budget membership helpers (security definer to avoid RLS
-- recursion when shared_budget_members policies reference themselves).
-- ---------------------------------------------------------------------
create or replace function public.is_budget_member(p_budget_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shared_budgets b
    where b.id = p_budget_id and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.shared_budget_members m
    where m.budget_id = p_budget_id
      and m.user_id = auth.uid()
      and m.status = 'accepted'
  );
$$;

create or replace function public.budget_role(p_budget_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (select 1 from public.shared_budgets b where b.id = p_budget_id and b.owner_id = auth.uid())
      then 'owner'
    else (
      select m.role::text from public.shared_budget_members m
      where m.budget_id = p_budget_id and m.user_id = auth.uid() and m.status = 'accepted'
      limit 1
    )
  end;
$$;

create or replace function public.is_budget_editor(p_budget_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.budget_role(p_budget_id) in ('owner', 'editor');
$$;
