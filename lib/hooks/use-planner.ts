"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { nextOccurrenceDate } from "@/lib/dates";
import type { Bill, BillPaycheckAllocation, Paycheck, PayFrequency } from "@/lib/types";

export interface PaycheckWithAllocations extends Paycheck {
  allocations: BillPaycheckAllocation[];
}

function advance(dateStr: string, frequency: PayFrequency): string {
  switch (frequency) {
    case "weekly":
      return nextOccurrenceDate(dateStr, "weekly", 1);
    case "biweekly":
      return nextOccurrenceDate(dateStr, "biweekly", 1);
    case "monthly":
      return nextOccurrenceDate(dateStr, "monthly", Number(dateStr.slice(8, 10)));
    case "semimonthly": {
      // Alternate between the 1st and 16th of the month.
      const [y, m, d] = dateStr.split("-").map(Number);
      if (d < 16) return `${y}-${String(m).padStart(2, "0")}-16`;
      const next = new Date(y, m, 1);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    }
    default:
      return dateStr;
  }
}

export function usePlanner(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [paychecks, setPaychecks] = React.useState<PaycheckWithAllocations[]>([]);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const [{ data: paycheckRows }, { data: billRows }] = await Promise.all([
      supabase.from("paychecks").select("*").eq("profile_id", profileId).order("date", { ascending: true }),
      supabase.from("bills").select("*").eq("profile_id", profileId).eq("active", true),
    ]);

    const checks = (paycheckRows ?? []) as Paycheck[];
    setBills((billRows ?? []) as Bill[]);

    if (checks.length === 0) {
      setPaychecks([]);
      setLoading(false);
      return;
    }

    const { data: allocRows } = await supabase
      .from("bill_paycheck_allocations")
      .select("*")
      .in(
        "paycheck_id",
        checks.map((c) => c.id),
      );
    const allocations = (allocRows ?? []) as BillPaycheckAllocation[];

    setPaychecks(
      checks.map((c) => ({ ...c, allocations: allocations.filter((a) => a.paycheck_id === c.id) })),
    );
    setLoading(false);
  }, [profileId, supabase]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const addManualPaycheck = React.useCallback(
    async (date: string, amount: number, label: string | null) => {
      if (!profileId) return;
      await supabase.from("paychecks").insert({ profile_id: profileId, date, amount, label, is_manual: true });
      await refresh();
    },
    [supabase, profileId, refresh],
  );

  const autoGenerate = React.useCallback(
    async (frequency: PayFrequency, startDate: string, count: number, amount: number) => {
      if (!profileId) return;
      const rows: { profile_id: string; date: string; amount: number; is_manual: boolean }[] = [];
      let cursor = startDate;
      for (let i = 0; i < count; i++) {
        rows.push({ profile_id: profileId, date: cursor, amount, is_manual: false });
        cursor = advance(cursor, frequency);
      }
      await supabase.from("paychecks").insert(rows);
      await refresh();
    },
    [supabase, profileId, refresh],
  );

  const deletePaycheck = React.useCallback(
    async (id: string) => {
      await supabase.from("paychecks").delete().eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const assignBill = React.useCallback(
    async (paycheckId: string, bill: Bill) => {
      await supabase
        .from("bill_paycheck_allocations")
        .insert({ paycheck_id: paycheckId, bill_id: bill.id, amount: bill.amount });
      await refresh();
    },
    [supabase, refresh],
  );

  const unassignBill = React.useCallback(
    async (allocationId: string) => {
      await supabase.from("bill_paycheck_allocations").delete().eq("id", allocationId);
      await refresh();
    },
    [supabase, refresh],
  );

  const allocatedBillIds = React.useMemo(
    () => new Set(paychecks.flatMap((p) => p.allocations.map((a) => a.bill_id))),
    [paychecks],
  );
  const unassignedBills = React.useMemo(
    () => bills.filter((b) => !allocatedBillIds.has(b.id)),
    [bills, allocatedBillIds],
  );

  return {
    paychecks,
    bills,
    unassignedBills,
    loading,
    refresh,
    addManualPaycheck,
    autoGenerate,
    deletePaycheck,
    assignBill,
    unassignBill,
  };
}
