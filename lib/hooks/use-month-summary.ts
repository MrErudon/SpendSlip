"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { IncomeSettings } from "@/lib/types";
import { bracketsFromRows, estimateTax, hourlyMonthlyGross, hoursNeededForGap, otRate } from "@/lib/tax";

export interface MonthSummary {
  loading: boolean;
  monthTotal: number;
  paidTotal: number;
  remainingTotal: number;
  overdueCount: number;
  netIncome: number;
  otStatus: {
    covered: boolean;
    hoursNeeded: number;
  } | null;
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Shared month-at-a-glance stats used by the sidebar footer and dashboard. */
export function useMonthSummary(profileId: string | null): MonthSummary {
  const supabase = React.useMemo(() => createClient(), []);
  const [summary, setSummary] = React.useState<MonthSummary>({
    loading: true,
    monthTotal: 0,
    paidTotal: 0,
    remainingTotal: 0,
    overdueCount: 0,
    netIncome: 0,
    otStatus: null,
  });

  React.useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      const { start, end } = monthBounds();
      const [{ data: occurrences }, { data: income }, { data: brackets }] = await Promise.all([
        supabase
          .from("bill_occurrences")
          .select("amount, paid, due_date")
          .eq("profile_id", profileId)
          .gte("due_date", start)
          .lte("due_date", end),
        supabase.from("income_settings").select("*").eq("profile_id", profileId).maybeSingle(),
        supabase.from("tax_brackets").select("*").eq("year", 2026),
      ]);
      if (cancelled) return;

      const rows = occurrences ?? [];
      const monthTotal = rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const paidTotal = rows.filter((r) => r.paid).reduce((sum, r) => sum + Number(r.amount), 0);
      const today = new Date().toISOString().slice(0, 10);
      const overdueCount = rows.filter((r) => !r.paid && r.due_date < today).length;

      let netIncome = 0;
      let otStatus: MonthSummary["otStatus"] = null;

      if (income) {
        const settings = income as IncomeSettings;
        const grossMonthly =
          settings.mode === "hourly"
            ? hourlyMonthlyGross({
                hourlyRate: settings.hourly_rate ?? 0,
                hoursPerWeek: settings.hours_per_week ?? 0,
              })
            : (settings.annual_salary ?? 0) / 12;
        const grossAnnual = grossMonthly * 12 + settings.additional_income * 12;

        const statusBrackets = brackets?.filter((b) => b.filing_status === settings.filing_status);
        const est = estimateTax({
          grossAnnualIncome: grossAnnual,
          filingStatus: settings.filing_status,
          stateRate: settings.state_rate,
          flatRateOverride: settings.flat_rate_override,
          brackets: statusBrackets && statusBrackets.length > 0 ? bracketsFromRows(statusBrackets) : undefined,
        });
        netIncome = est.netAnnual / 12 + settings.additional_income;

        const gap = monthTotal - netIncome;
        if (gap > 0 && settings.mode === "hourly" && settings.hourly_rate) {
          const netOtRate = otRate(settings.hourly_rate) * (1 - est.effectiveRate);
          otStatus = { covered: false, hoursNeeded: hoursNeededForGap(gap, netOtRate) };
        } else {
          otStatus = { covered: true, hoursNeeded: 0 };
        }
      }

      setSummary({
        loading: false,
        monthTotal,
        paidTotal,
        remainingTotal: monthTotal - paidTotal,
        overdueCount,
        netIncome,
        otStatus,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profileId, supabase]);

  return summary;
}
