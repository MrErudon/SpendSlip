"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { BillOccurrence } from "@/lib/types";

export interface OverdueBill {
  occurrenceId: string;
  billName: string;
  dueDate: string;
  amount: number;
}

export interface ActivityItem {
  id: string;
  billName: string;
  amount: number;
  paidAt: string;
}

export function useDashboard(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [overdue, setOverdue] = React.useState<OverdueBill[]>([]);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [reviewCount, setReviewCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: overdueRows }, { data: activityRows }, { count }] = await Promise.all([
      supabase
        .from("bill_occurrences")
        .select("id, due_date, amount, bills(name)")
        .eq("profile_id", profileId)
        .eq("paid", false)
        .lt("due_date", today)
        .order("due_date", { ascending: true }),
      supabase
        .from("bill_occurrences")
        .select("id, paid_at, amount, bills(name)")
        .eq("profile_id", profileId)
        .eq("paid", true)
        .order("paid_at", { ascending: false })
        .limit(8),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("budget_profile_id", profileId)
        .eq("needs_review", true),
    ]);
    setReviewCount(count ?? 0);

    setOverdue(
      ((overdueRows ?? []) as unknown as (BillOccurrence & { bills: { name: string } | null })[]).map((o) => ({
        occurrenceId: o.id,
        billName: o.bills?.name ?? "Bill",
        dueDate: o.due_date,
        amount: Number(o.amount),
      })),
    );

    setActivity(
      ((activityRows ?? []) as unknown as (BillOccurrence & { bills: { name: string } | null })[])
        .filter((o) => o.paid_at)
        .map((o) => ({
          id: o.id,
          billName: o.bills?.name ?? "Bill",
          amount: Number(o.amount),
          paidAt: o.paid_at as string,
        })),
    );

    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { overdue, activity, reviewCount, loading, refresh };
}
