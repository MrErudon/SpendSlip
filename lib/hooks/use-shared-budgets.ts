"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { SharedBudget, SharedBudgetMember } from "@/lib/types";

export function useSharedBudgets(userId: string | null, userEmail: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [budgets, setBudgets] = React.useState<SharedBudget[]>([]);
  const [pendingInvites, setPendingInvites] = React.useState<(SharedBudgetMember & { budget: SharedBudget | null })[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: budgetRows } = await supabase
      .from("shared_budgets")
      .select("*")
      .order("created_at", { ascending: false });
    setBudgets((budgetRows ?? []) as SharedBudget[]);

    const { data: inviteRows } = await supabase
      .from("shared_budget_members")
      .select("*, budget:shared_budgets(*)")
      .eq("status", "pending")
      .or(`user_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ""}`);
    setPendingInvites((inviteRows ?? []) as unknown as (SharedBudgetMember & { budget: SharedBudget | null })[]);

    setLoading(false);
  }, [supabase, userId, userEmail]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const createBudget = React.useCallback(
    async (input: { name: string; emoji: string; goal_label: string | null; goal_amount: number | null; deadline: string | null }) => {
      if (!userId || !userEmail) return null;
      const { data: budget, error } = await supabase
        .from("shared_budgets")
        .insert({ ...input, owner_id: userId })
        .select()
        .single();
      if (error || !budget) return null;

      await supabase.from("shared_budget_members").insert({
        budget_id: budget.id,
        user_id: userId,
        email: userEmail,
        role: "owner",
        status: "accepted",
        display_name: userEmail,
      });

      await refresh();
      return budget as SharedBudget;
    },
    [supabase, userId, userEmail, refresh],
  );

  const acceptInvite = React.useCallback(
    async (memberId: string) => {
      if (!userId) return;
      await supabase.from("shared_budget_members").update({ status: "accepted", user_id: userId }).eq("id", memberId);
      await refresh();
    },
    [supabase, userId, refresh],
  );

  const declineInvite = React.useCallback(
    async (memberId: string) => {
      await supabase.from("shared_budget_members").update({ status: "declined" }).eq("id", memberId);
      await refresh();
    },
    [supabase, refresh],
  );

  return { budgets, pendingInvites, loading, refresh, createBudget, acceptInvite, declineInvite };
}
