-- A pending invite row has user_id = null until the invitee signs in for
-- the first time after being invited (see link_pending_invites()). Until
-- then, the original SELECT/UPDATE policies on shared_budget_members
-- can't recognize the invitee as themselves, so they can never see or
-- accept their own invite. Patch both policies to also match on the
-- session JWT's email claim.

drop policy if exists "members: select fellow members" on public.shared_budget_members;
create policy "members: select fellow members" on public.shared_budget_members
  for select using (
    public.is_budget_member(budget_id)
    or user_id = auth.uid()
    or email = (auth.jwt() ->> 'email')
  );

drop policy if exists "members: owner or self update" on public.shared_budget_members;
create policy "members: owner or self update" on public.shared_budget_members
  for update using (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
    or user_id = auth.uid()
    or email = (auth.jwt() ->> 'email')
  ) with check (
    exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
    or user_id = auth.uid()
    or email = (auth.jwt() ->> 'email')
  );
