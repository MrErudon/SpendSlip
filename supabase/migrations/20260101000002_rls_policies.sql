-- Row Level Security for every table. Personal data is scoped to
-- budget_profiles.user_id = auth.uid(); shared budgets use the
-- is_budget_member / is_budget_editor / budget_role helpers.

alter table public.budget_profiles enable row level security;
alter table public.bill_categories enable row level security;
alter table public.bills enable row level security;
alter table public.bill_occurrences enable row level security;
alter table public.income_settings enable row level security;
alter table public.paychecks enable row level security;
alter table public.bill_paycheck_allocations enable row level security;
alter table public.shared_budgets enable row level security;
alter table public.shared_budget_members enable row level security;
alter table public.shared_budget_income enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.tax_brackets enable row level security;

-- ---------------------------------------------------------------------
-- budget_profiles
-- ---------------------------------------------------------------------
create policy "profiles: select own" on public.budget_profiles
  for select using (user_id = auth.uid());
create policy "profiles: insert own" on public.budget_profiles
  for insert with check (user_id = auth.uid());
create policy "profiles: update own" on public.budget_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles: delete own" on public.budget_profiles
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- bill_categories (scoped via parent profile ownership)
-- ---------------------------------------------------------------------
create policy "categories: select own" on public.bill_categories
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "categories: insert own" on public.bill_categories
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "categories: update own" on public.bill_categories
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "categories: delete own" on public.bill_categories
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------
create policy "bills: select own" on public.bills
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "bills: insert own" on public.bills
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "bills: update own" on public.bills
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "bills: delete own" on public.bills
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- bill_occurrences
-- ---------------------------------------------------------------------
create policy "occurrences: select own" on public.bill_occurrences
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "occurrences: insert own" on public.bill_occurrences
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "occurrences: update own" on public.bill_occurrences
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "occurrences: delete own" on public.bill_occurrences
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- income_settings
-- ---------------------------------------------------------------------
create policy "income: select own" on public.income_settings
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "income: insert own" on public.income_settings
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "income: update own" on public.income_settings
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "income: delete own" on public.income_settings
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- paychecks
-- ---------------------------------------------------------------------
create policy "paychecks: select own" on public.paychecks
  for select using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "paychecks: insert own" on public.paychecks
  for insert with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "paychecks: update own" on public.paychecks
  for update using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "paychecks: delete own" on public.paychecks
  for delete using (
    exists (select 1 from public.budget_profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- bill_paycheck_allocations (scoped via parent paycheck's profile)
-- ---------------------------------------------------------------------
create policy "allocations: select own" on public.bill_paycheck_allocations
  for select using (
    exists (
      select 1 from public.paychecks pc
      join public.budget_profiles p on p.id = pc.profile_id
      where pc.id = paycheck_id and p.user_id = auth.uid()
    )
  );
create policy "allocations: insert own" on public.bill_paycheck_allocations
  for insert with check (
    exists (
      select 1 from public.paychecks pc
      join public.budget_profiles p on p.id = pc.profile_id
      where pc.id = paycheck_id and p.user_id = auth.uid()
    )
  );
create policy "allocations: update own" on public.bill_paycheck_allocations
  for update using (
    exists (
      select 1 from public.paychecks pc
      join public.budget_profiles p on p.id = pc.profile_id
      where pc.id = paycheck_id and p.user_id = auth.uid()
    )
  );
create policy "allocations: delete own" on public.bill_paycheck_allocations
  for delete using (
    exists (
      select 1 from public.paychecks pc
      join public.budget_profiles p on p.id = pc.profile_id
      where pc.id = paycheck_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- shared_budgets
-- ---------------------------------------------------------------------
create policy "shared budgets: select members" on public.shared_budgets
  for select using (public.is_budget_member(id));
create policy "shared budgets: insert own" on public.shared_budgets
  for insert with check (owner_id = auth.uid());
create policy "shared budgets: update owner" on public.shared_budgets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shared budgets: delete owner" on public.shared_budgets
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- shared_budget_members
-- ---------------------------------------------------------------------
create policy "members: select fellow members" on public.shared_budget_members
  for select using (public.is_budget_member(budget_id) or user_id = auth.uid());
create policy "members: owner invites" on public.shared_budget_members
  for insert with check (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
  );
create policy "members: owner or self update" on public.shared_budget_members
  for update using (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
    or user_id = auth.uid()
  ) with check (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
    or user_id = auth.uid()
  );
create policy "members: owner removes" on public.shared_budget_members
  for delete using (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
    or user_id = auth.uid()
  );

-- ---------------------------------------------------------------------
-- shared_budget_income (visible to all members, writable only by self)
-- ---------------------------------------------------------------------
create policy "shared income: select members" on public.shared_budget_income
  for select using (public.is_budget_member(budget_id));
create policy "shared income: insert self" on public.shared_budget_income
  for insert with check (
    exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid() and m.budget_id = shared_budget_income.budget_id
    )
  );
create policy "shared income: update self" on public.shared_budget_income
  for update using (
    exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid() and m.budget_id = shared_budget_income.budget_id
    )
  ) with check (
    exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid() and m.budget_id = shared_budget_income.budget_id
    )
  );
create policy "shared income: delete self" on public.shared_budget_income
  for delete using (
    exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid() and m.budget_id = shared_budget_income.budget_id
    )
  );

-- ---------------------------------------------------------------------
-- goal_contributions (visible to all members, loggable by owner/editor)
-- ---------------------------------------------------------------------
create policy "contributions: select members" on public.goal_contributions
  for select using (public.is_budget_member(budget_id));
create policy "contributions: insert editors" on public.goal_contributions
  for insert with check (
    public.is_budget_editor(budget_id)
    and exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid() and m.budget_id = goal_contributions.budget_id
    )
  );
create policy "contributions: delete own or owner" on public.goal_contributions
  for delete using (
    exists (
      select 1 from public.shared_budget_members m
      where m.id = member_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- notification_settings
-- ---------------------------------------------------------------------
create policy "notifications: select own" on public.notification_settings
  for select using (user_id = auth.uid());
create policy "notifications: insert own" on public.notification_settings
  for insert with check (user_id = auth.uid());
create policy "notifications: update own" on public.notification_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: delete own" on public.notification_settings
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- tax_brackets: public reference data, readable by any authenticated user
-- ---------------------------------------------------------------------
create policy "tax brackets: read all" on public.tax_brackets
  for select using (auth.role() = 'authenticated');
