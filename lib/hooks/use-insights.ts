"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { MonthRange } from "@/components/month-selector";
import {
  categoryTotals,
  detectCategoryAnomalies,
  detectLargeTransactions,
  detectPossibleDuplicates,
  forMonth,
  largestTransactions,
  monthKey,
  monthOverMonth,
  monthlySummary,
  spendingByTag,
  topMerchants,
  type AnalyzableTransaction,
  type Insight,
} from "@/lib/statements/insights";
import { generateSuggestedBudget, type SuggestedBudget } from "@/lib/statements/budget-generator";
import { forecastMonthEnd, type ForecastResult } from "@/lib/statements/forecast";
import { currentMonthKey } from "@/components/month-selector";

const HISTORY_MONTHS = 13; // enough trailing history for MoM + anomaly baselines

function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useInsights(profileId: string | null, range: MonthRange) {
  const supabase = React.useMemo(() => createClient(), []);
  const [transactions, setTransactions] = React.useState<AnalyzableTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [categoryBudgets, setCategoryBudgets] = React.useState<Map<string, number>>(new Map());

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const windowStart = shiftMonthKey(range.month, -HISTORY_MONTHS);
    const [{ data: txnRows }, { data: catRows }] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, transaction_date, amount, direction, normalized_merchant, is_excluded, is_transfer, is_credit_card_payment, is_income, is_recurring, spending_categories(name, spending_tag)",
        )
        .eq("budget_profile_id", profileId)
        .gte("transaction_date", `${windowStart}-01`)
        .lte("transaction_date", `${range.month}-31`),
      supabase.from("spending_categories").select("name, budget_amount").eq("budget_profile_id", profileId),
    ]);

    setTransactions(
      ((txnRows ?? []) as unknown as {
        id: string;
        transaction_date: string;
        amount: number;
        direction: "inflow" | "outflow";
        normalized_merchant: string;
        is_excluded: boolean;
        is_transfer: boolean;
        is_credit_card_payment: boolean;
        is_income: boolean;
        is_recurring: boolean;
        spending_categories: { name: string; spending_tag: AnalyzableTransaction["spendingTag"] } | null;
      }[]).map((r) => ({
        id: r.id,
        transactionDate: r.transaction_date,
        amount: Number(r.amount),
        direction: r.direction,
        normalizedMerchant: r.normalized_merchant,
        categoryName: r.spending_categories?.name ?? null,
        spendingTag: r.spending_categories?.spending_tag ?? null,
        isExcluded: r.is_excluded,
        isTransfer: r.is_transfer,
        isCreditCardPayment: r.is_credit_card_payment,
        isIncome: r.is_income,
        isRecurring: r.is_recurring,
      })),
    );

    setCategoryBudgets(
      new Map(((catRows ?? []) as { name: string; budget_amount: number | null }[]).filter((c) => c.budget_amount).map((c) => [c.name, c.budget_amount as number])),
    );
    setLoading(false);
  }, [supabase, profileId, range.month]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const rangeMonthKeys = React.useMemo(() => {
    const keys: string[] = [];
    for (let i = range.rangeMonths - 1; i >= 0; i--) keys.push(shiftMonthKey(range.month, -i));
    return keys;
  }, [range]);

  const inRangeTxns = React.useMemo(
    () => transactions.filter((t) => rangeMonthKeys.includes(monthKey(t.transactionDate))),
    [transactions, rangeMonthKeys],
  );
  const currentMonthTxns = React.useMemo(() => forMonth(transactions, range.month), [transactions, range.month]);
  const previousMonthTxns = React.useMemo(
    () => forMonth(transactions, shiftMonthKey(range.month, -1)),
    [transactions, range.month],
  );

  const summary = React.useMemo(() => monthlySummary(currentMonthTxns), [currentMonthTxns]);
  const categories = React.useMemo(() => categoryTotals(inRangeTxns), [inRangeTxns]);
  const comparison = React.useMemo(() => monthOverMonth(currentMonthTxns, previousMonthTxns), [currentMonthTxns, previousMonthTxns]);
  const merchants = React.useMemo(() => topMerchants(inRangeTxns), [inRangeTxns]);
  const largest = React.useMemo(() => largestTransactions(inRangeTxns), [inRangeTxns]);
  const tagBreakdown = React.useMemo(() => spendingByTag(inRangeTxns), [inRangeTxns]);

  const insights = React.useMemo<Insight[]>(() => {
    // Historical average excludes the current (possibly in-progress) month.
    const priorMonths = new Set(rangeMonthKeys.filter((m) => m !== range.month));
    const priorTxns = transactions.filter((t) => priorMonths.has(monthKey(t.transactionDate)));
    const monthsCount = Math.max(1, priorMonths.size);

    const categoryAverages = new Map<string, number>();
    for (const c of categoryTotals(priorTxns)) categoryAverages.set(c.categoryName, c.total / monthsCount);

    const merchantAverages = new Map<string, number>();
    const merchantSums = new Map<string, { total: number; count: number }>();
    for (const t of priorTxns) {
      const entry = merchantSums.get(t.normalizedMerchant) ?? { total: 0, count: 0 };
      entry.total += Math.abs(t.amount);
      entry.count += 1;
      merchantSums.set(t.normalizedMerchant, entry);
    }
    for (const [merchant, { total, count }] of merchantSums) merchantAverages.set(merchant, total / count);

    return [
      ...detectCategoryAnomalies(categoryTotals(currentMonthTxns), categoryAverages),
      ...detectLargeTransactions(currentMonthTxns, merchantAverages),
      ...detectPossibleDuplicates(currentMonthTxns),
    ];
  }, [transactions, currentMonthTxns, rangeMonthKeys, range.month]);

  const suggestedBudget = React.useMemo<SuggestedBudget>(() => {
    const priorMonthKeys = rangeMonthKeys.length > 1 ? rangeMonthKeys : [shiftMonthKey(range.month, -2), shiftMonthKey(range.month, -1), range.month];
    const byCategory = new Map<string, number[]>();
    for (const m of priorMonthKeys) {
      for (const c of categoryTotals(forMonth(transactions, m))) {
        const list = byCategory.get(c.categoryName) ?? [];
        list.push(c.total);
        byCategory.set(c.categoryName, list);
      }
    }
    const avgIncome =
      priorMonthKeys.reduce((sum, m) => sum + monthlySummary(forMonth(transactions, m)).income, 0) / priorMonthKeys.length;
    return generateSuggestedBudget(byCategory, avgIncome);
  }, [transactions, rangeMonthKeys, range.month]);

  return {
    loading,
    refresh,
    summary,
    categories,
    comparison,
    merchants,
    largest,
    tagBreakdown,
    insights,
    suggestedBudget,
    categoryBudgets,
    currentMonthTxns,
  };
}

/** Forecast is always about the real current month, independent of the
 * insights page's browsing range — you can't forecast a past month. */
export function useForecast(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [forecast, setForecast] = React.useState<ForecastResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const month = currentMonthKey();
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

      const [{ data: txnRows }, { data: billRows }, { data: paycheckRows }] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount, direction, transaction_date, is_excluded, is_transfer, is_credit_card_payment, is_income, spending_categories(spending_tag)")
          .eq("budget_profile_id", profileId)
          .gte("transaction_date", `${shiftMonthKey(month, -3)}-01`)
          .lte("transaction_date", `${month}-31`),
        supabase
          .from("bill_occurrences")
          .select("amount, paid, due_date")
          .eq("profile_id", profileId)
          .eq("paid", false)
          .gte("due_date", `${month}-01`)
          .lte("due_date", `${month}-31`),
        supabase.from("paychecks").select("amount, date").eq("profile_id", profileId).gte("date", `${month}-01`).lte("date", `${month}-31`),
      ]);
      if (cancelled) return;

      const rows = ((txnRows ?? []) as unknown as {
        amount: number;
        direction: "inflow" | "outflow";
        transaction_date: string;
        is_excluded: boolean;
        is_transfer: boolean;
        is_credit_card_payment: boolean;
        is_income: boolean;
        spending_categories: { spending_tag: string | null } | null;
      }[]).map((r) => ({
        amount: Number(r.amount),
        direction: r.direction,
        transactionDate: r.transaction_date,
        isExcluded: r.is_excluded,
        isTransfer: r.is_transfer,
        isCreditCardPayment: r.is_credit_card_payment,
        isIncome: r.is_income,
        spendingTag: r.spending_categories?.spending_tag ?? null,
      }));

      const isSpend = (r: (typeof rows)[number]) => r.direction === "outflow" && !r.isExcluded && !r.isTransfer && !r.isCreditCardPayment && !r.isIncome;
      const thisMonth = rows.filter((r) => r.transactionDate.startsWith(month));
      const spentSoFar = thisMonth.filter(isSpend).reduce((s, r) => s + Math.abs(r.amount), 0);
      const discretionarySpentSoFar = thisMonth
        .filter((r) => isSpend(r) && r.spendingTag === "discretionary")
        .reduce((s, r) => s + Math.abs(r.amount), 0);

      const priorMonths = [shiftMonthKey(month, -1), shiftMonthKey(month, -2), shiftMonthKey(month, -3)];
      const priorDiscretionary =
        priorMonths.reduce((sum, m) => {
          const monthRows = rows.filter((r) => r.transactionDate.startsWith(m) && isSpend(r) && r.spendingTag === "discretionary");
          return sum + monthRows.reduce((s, r) => s + Math.abs(r.amount), 0);
        }, 0) / priorMonths.length;

      const expectedRemainingBills = (billRows ?? []).reduce((s, b) => s + Number(b.amount), 0);
      const expectedIncome = (paycheckRows ?? []).reduce((s, p) => s + Number(p.amount), 0);

      setForecast(
        forecastMonthEnd({
          spentSoFar,
          expectedRemainingBills,
          discretionarySpentSoFar,
          historicalMonthlyDiscretionaryAverage: priorDiscretionary,
          expectedIncome,
          daysElapsedInMonth: today.getDate(),
          daysInMonth,
        }),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profileId, supabase]);

  return { forecast, loading };
}
