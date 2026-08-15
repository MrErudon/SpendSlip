"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { detectAndPersistRecurring } from "@/lib/statements/detect-recurring";
import type { RecurringGroup } from "@/lib/types-financial";
import type { Bill, Recurrence } from "@/lib/types";

const FREQUENCY_TO_RECURRENCE: Record<RecurringGroup["frequency"], Recurrence> = {
  weekly: "weekly",
  biweekly: "biweekly",
  monthly: "monthly",
  quarterly: "monthly", // closest existing Bills cadence; amount already reflects the per-charge total
  semiannual: "monthly",
  annual: "annual",
};

export function useRecurringGroups(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [groups, setGroups] = React.useState<RecurringGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from("recurring_groups")
      .select("*")
      .eq("budget_profile_id", profileId)
      .neq("status", "ignored")
      .order("estimated_amount", { ascending: false });
    setGroups((data ?? []) as RecurringGroup[]);
    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const rescan = React.useCallback(async () => {
    if (!profileId) return;
    setScanning(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await detectAndPersistRecurring(supabase, user.id, profileId);
    await refresh();
    setScanning(false);
  }, [supabase, profileId, refresh]);

  const confirm = React.useCallback(
    async (id: string) => {
      await supabase.from("recurring_groups").update({ status: "confirmed" }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const ignore = React.useCallback(
    async (id: string) => {
      await supabase.from("recurring_groups").update({ status: "ignored" }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const attachToBill = React.useCallback(
    async (id: string, billId: string) => {
      await supabase.from("recurring_groups").update({ linked_bill_id: billId, status: "confirmed" }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const createBillFromGroup = React.useCallback(
    async (group: RecurringGroup, categoryId: string | null) => {
      if (!profileId) return;
      const { data: cats } = await supabase.from("bill_categories").select("id").eq("profile_id", profileId).limit(1);
      const fallbackCategoryId = categoryId ?? cats?.[0]?.id;
      if (!fallbackCategoryId) return;

      const dueDay = group.next_expected_date ? new Date(`${group.next_expected_date}T00:00:00`).getDate() : 1;
      const { data: bill } = await supabase
        .from("bills")
        .insert({
          profile_id: profileId,
          category_id: fallbackCategoryId,
          name: group.normalized_merchant,
          amount: group.estimated_amount,
          due_day: dueDay,
          recurrence: FREQUENCY_TO_RECURRENCE[group.frequency],
          autopay: true,
        })
        .select()
        .single();
      if (bill) await attachToBill(group.id, (bill as Bill).id);
    },
    [supabase, profileId, attachToBill],
  );

  const metrics = React.useMemo(() => {
    const active = groups.filter((g) => g.status !== "ignored");
    const monthly = active.reduce((sum, g) => {
      const periodsPerYear = 365 / { weekly: 7, biweekly: 14, monthly: 30.4, quarterly: 91.3, semiannual: 182.6, annual: 365 }[g.frequency];
      return sum + (g.estimated_amount * periodsPerYear) / 12;
    }, 0);
    return { monthlyTotal: monthly, annualTotal: monthly * 12, count: active.length };
  }, [groups]);

  return { groups, loading, scanning, metrics, refresh, rescan, confirm, ignore, attachToBill, createBillFromGroup };
}
