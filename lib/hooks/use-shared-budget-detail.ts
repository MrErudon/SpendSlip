"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { GoalContribution, MemberRole, SharedBudget, SharedBudgetIncome, SharedBudgetMember } from "@/lib/types";

export function useSharedBudgetDetail(budgetId: string | null, userId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [budget, setBudget] = React.useState<SharedBudget | null>(null);
  const [members, setMembers] = React.useState<SharedBudgetMember[]>([]);
  const [incomes, setIncomes] = React.useState<SharedBudgetIncome[]>([]);
  const [contributions, setContributions] = React.useState<GoalContribution[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!budgetId) return;
    setLoading(true);

    const [{ data: b }, { data: m }, { data: inc }, { data: contrib }] = await Promise.all([
      supabase.from("shared_budgets").select("*").eq("id", budgetId).single(),
      supabase.from("shared_budget_members").select("*").eq("budget_id", budgetId).order("created_at", { ascending: true }),
      supabase.from("shared_budget_income").select("*").eq("budget_id", budgetId),
      supabase.from("goal_contributions").select("*").eq("budget_id", budgetId).order("created_at", { ascending: false }),
    ]);

    setBudget((b as SharedBudget) ?? null);
    setMembers((m ?? []) as SharedBudgetMember[]);
    setIncomes((inc ?? []) as SharedBudgetIncome[]);
    setContributions((contrib ?? []) as GoalContribution[]);
    setLoading(false);
  }, [supabase, budgetId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const myMember = members.find((m) => m.user_id === userId) ?? null;
  const myRole: MemberRole | null = myMember?.role ?? null;
  const isOwner = budget?.owner_id === userId;

  const inviteMember = React.useCallback(
    async (email: string, role: MemberRole) => {
      if (!budgetId) return;
      await supabase.from("shared_budget_members").insert({ budget_id: budgetId, email, role, status: "pending" });
      await refresh();
    },
    [supabase, budgetId, refresh],
  );

  const removeMember = React.useCallback(
    async (memberId: string) => {
      await supabase.from("shared_budget_members").delete().eq("id", memberId);
      await refresh();
    },
    [supabase, refresh],
  );

  const setMyIncome = React.useCallback(
    async (netMonthlyIncome: number) => {
      if (!budgetId || !myMember) return;
      const existing = incomes.find((i) => i.member_id === myMember.id);
      if (existing) {
        await supabase
          .from("shared_budget_income")
          .update({ net_monthly_income: netMonthlyIncome })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("shared_budget_income")
          .insert({ budget_id: budgetId, member_id: myMember.id, net_monthly_income: netMonthlyIncome });
      }
      await refresh();
    },
    [supabase, budgetId, myMember, incomes, refresh],
  );

  const logContribution = React.useCallback(
    async (amount: number, note: string | null) => {
      if (!budgetId || !myMember) return;
      await supabase.from("goal_contributions").insert({ budget_id: budgetId, member_id: myMember.id, amount, note });
      await refresh();
    },
    [supabase, budgetId, myMember, refresh],
  );

  const updateBudget = React.useCallback(
    async (input: Partial<Pick<SharedBudget, "name" | "emoji" | "goal_label" | "goal_amount" | "deadline">>) => {
      if (!budgetId) return;
      await supabase.from("shared_budgets").update(input).eq("id", budgetId);
      await refresh();
    },
    [supabase, budgetId, refresh],
  );

  const deleteBudget = React.useCallback(async () => {
    if (!budgetId) return;
    await supabase.from("shared_budgets").delete().eq("id", budgetId);
  }, [supabase, budgetId]);

  return {
    budget,
    members,
    incomes,
    contributions,
    loading,
    myMember,
    myRole,
    isOwner,
    refresh,
    inviteMember,
    removeMember,
    setMyIncome,
    logContribution,
    updateBudget,
    deleteBudget,
  };
}
