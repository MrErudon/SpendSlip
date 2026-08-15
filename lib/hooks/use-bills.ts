"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { firstOccurrenceDate } from "@/lib/dates";
import type { Bill, BillCategory, BillOccurrence, Recurrence } from "@/lib/types";

export interface BillWithOccurrence extends Bill {
  occurrence: BillOccurrence | null;
}

export interface BillInput {
  name: string;
  amount: number;
  due_day: number;
  payment_url: string | null;
  recurrence: Recurrence;
  autopay: boolean;
  notes: string | null;
  category_id: string;
}

const WINDOW_PAST_DAYS = 14;
const WINDOW_FUTURE_DAYS = 120;

export function useBills(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [categories, setCategories] = React.useState<BillCategory[]>([]);
  const [bills, setBills] = React.useState<BillWithOccurrence[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const { data: cats } = await supabase
      .from("bill_categories")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true });
    setCategories((cats ?? []) as BillCategory[]);

    const { data: billRows } = await supabase
      .from("bills")
      .select("*")
      .eq("profile_id", profileId)
      .eq("active", true)
      .order("due_day", { ascending: true });
    const billList = (billRows ?? []) as Bill[];

    if (billList.length === 0) {
      setBills([]);
      setLoading(false);
      return;
    }

    const past = new Date();
    past.setDate(past.getDate() - WINDOW_PAST_DAYS);
    const future = new Date();
    future.setDate(future.getDate() + WINDOW_FUTURE_DAYS);

    const { data: occRows } = await supabase
      .from("bill_occurrences")
      .select("*")
      .in(
        "bill_id",
        billList.map((b) => b.id),
      )
      .gte("due_date", past.toISOString().slice(0, 10))
      .lte("due_date", future.toISOString().slice(0, 10))
      .order("due_date", { ascending: true });

    const occurrences = (occRows ?? []) as BillOccurrence[];
    const byBill = new Map<string, BillOccurrence[]>();
    for (const occ of occurrences) {
      const list = byBill.get(occ.bill_id) ?? [];
      list.push(occ);
      byBill.set(occ.bill_id, list);
    }

    const withOccurrence: BillWithOccurrence[] = billList.map((bill) => {
      const occs = byBill.get(bill.id) ?? [];
      const unpaid = occs.find((o) => !o.paid);
      const current = unpaid ?? occs[occs.length - 1] ?? null;
      return { ...bill, occurrence: current };
    });

    setBills(withOccurrence);
    setLoading(false);
  }, [profileId, supabase]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const addCategory = React.useCallback(
    async (name: string) => {
      if (!profileId) return;
      await supabase
        .from("bill_categories")
        .insert({ profile_id: profileId, name, sort_order: categories.length });
      await refresh();
    },
    [supabase, profileId, categories.length, refresh],
  );

  const renameCategory = React.useCallback(
    async (id: string, name: string) => {
      await supabase.from("bill_categories").update({ name }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const removeCategory = React.useCallback(
    async (id: string) => {
      await supabase.from("bill_categories").delete().eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const addBill = React.useCallback(
    async (input: BillInput) => {
      if (!profileId) return;
      const { data: bill, error } = await supabase
        .from("bills")
        .insert({ ...input, profile_id: profileId })
        .select()
        .single();
      if (error || !bill) return;

      const dueDate = firstOccurrenceDate(input.due_day);
      await supabase.from("bill_occurrences").insert({
        bill_id: bill.id,
        profile_id: profileId,
        due_date: dueDate,
        period_key: dueDate,
        amount: input.amount,
        paid: false,
      });
      await refresh();
    },
    [supabase, profileId, refresh],
  );

  const updateBill = React.useCallback(
    async (id: string, input: Partial<BillInput>) => {
      await supabase.from("bills").update(input).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const deleteBill = React.useCallback(
    async (id: string) => {
      await supabase.from("bills").update({ active: false }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const toggleOccurrencePaid = React.useCallback(
    async (occurrenceId: string, paid: boolean) => {
      await supabase
        .from("bill_occurrences")
        .update({ paid, paid_at: paid ? new Date().toISOString() : null })
        .eq("id", occurrenceId);
      await refresh();
    },
    [supabase, refresh],
  );

  return {
    categories,
    bills,
    loading,
    refresh,
    addCategory,
    renameCategory,
    removeCategory,
    addBill,
    updateBill,
    deleteBill,
    toggleOccurrencePaid,
  };
}
