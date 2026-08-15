import type { SpendingTag } from "@/lib/types-financial";

/**
 * Pure spending-analysis functions over already-loaded transactions.
 * Nothing here touches Supabase — callers (hooks/routes) fetch the rows
 * and pass them in, which keeps this trivially unit-testable and mirrors
 * the style of lib/tax.ts elsewhere in the app.
 */

export interface AnalyzableTransaction {
  id: string;
  transactionDate: string; // ISO date
  amount: number; // signed
  direction: "inflow" | "outflow";
  normalizedMerchant: string;
  categoryName: string | null;
  spendingTag: SpendingTag | null;
  isExcluded: boolean;
  isTransfer: boolean;
  isCreditCardPayment: boolean;
  isIncome: boolean;
  isRecurring: boolean;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** True spending only: real outflows, not transfers/CC payments/excluded/income. */
export function countsAsSpend(t: AnalyzableTransaction): boolean {
  return t.direction === "outflow" && !t.isExcluded && !t.isTransfer && !t.isCreditCardPayment && !t.isIncome;
}

export function countsAsIncome(t: AnalyzableTransaction): boolean {
  return t.direction === "inflow" && !t.isExcluded && !t.isTransfer && (t.isIncome || t.categoryName === "Income");
}

export function forMonth(transactions: AnalyzableTransaction[], month: string): AnalyzableTransaction[] {
  return transactions.filter((t) => monthKey(t.transactionDate) === month);
}

export interface CategoryTotal {
  categoryName: string;
  total: number;
  count: number;
}

export function categoryTotals(transactions: AnalyzableTransaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of transactions.filter(countsAsSpend)) {
    const key = t.categoryName ?? "Uncategorized";
    const entry = map.get(key) ?? { categoryName: key, total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface CategoryComparison {
  categoryName: string;
  current: number;
  previous: number;
  changePct: number | null; // null when there's no previous-month baseline
}

export function monthOverMonth(
  currentMonthTxns: AnalyzableTransaction[],
  previousMonthTxns: AnalyzableTransaction[],
): CategoryComparison[] {
  const current = new Map(categoryTotals(currentMonthTxns).map((c) => [c.categoryName, c.total]));
  const previous = new Map(categoryTotals(previousMonthTxns).map((c) => [c.categoryName, c.total]));
  const names = new Set([...current.keys(), ...previous.keys()]);

  return [...names]
    .map((name) => {
      const cur = current.get(name) ?? 0;
      const prev = previous.get(name) ?? 0;
      return { categoryName: name, current: cur, previous: prev, changePct: prev > 0 ? (cur - prev) / prev : null };
    })
    .sort((a, b) => b.current - a.current);
}

export interface MerchantTotal {
  merchant: string;
  total: number;
  count: number;
}

export function topMerchants(transactions: AnalyzableTransaction[], limit = 8): MerchantTotal[] {
  const map = new Map<string, MerchantTotal>();
  for (const t of transactions.filter(countsAsSpend)) {
    const entry = map.get(t.normalizedMerchant) ?? { merchant: t.normalizedMerchant, total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    map.set(t.normalizedMerchant, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export function largestTransactions(transactions: AnalyzableTransaction[], limit = 8): AnalyzableTransaction[] {
  return [...transactions.filter(countsAsSpend)].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, limit);
}

export interface TagBreakdown {
  tag: SpendingTag | "untagged";
  total: number;
}

export function spendingByTag(transactions: AnalyzableTransaction[]): TagBreakdown[] {
  const map = new Map<string, number>();
  for (const t of transactions.filter(countsAsSpend)) {
    const key = t.spendingTag ?? "untagged";
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  return [...map.entries()].map(([tag, total]) => ({ tag: tag as SpendingTag | "untagged", total })).sort((a, b) => b.total - a.total);
}

export function recurringSpend(transactions: AnalyzableTransaction[]): number {
  return transactions.filter((t) => countsAsSpend(t) && t.isRecurring).reduce((s, t) => s + Math.abs(t.amount), 0);
}

export interface MonthlySummary {
  income: number;
  spending: number;
  surplus: number;
  savingsRate: number; // 0-1
  largestCategory: CategoryTotal | null;
  recurringCharges: number;
}

export function monthlySummary(transactions: AnalyzableTransaction[]): MonthlySummary {
  const income = transactions.filter(countsAsIncome).reduce((s, t) => s + t.amount, 0);
  const spending = transactions.filter(countsAsSpend).reduce((s, t) => s + Math.abs(t.amount), 0);
  const surplus = income - spending;
  const cats = categoryTotals(transactions);
  return {
    income,
    spending,
    surplus,
    savingsRate: income > 0 ? surplus / income : 0,
    largestCategory: cats[0] ?? null,
    recurringCharges: recurringSpend(transactions),
  };
}

// --- Anomaly / "worth reviewing" detection --------------------------------
// Deliberately non-alarmist copy — never "fraud"/"suspicious", always
// "worth reviewing" framing per docs/statement-import-expansion-plan.md.

export interface Insight {
  type: "category_above_average" | "large_transaction" | "possible_duplicate" | "new_recurring";
  title: string;
  message: string;
}

const CATEGORY_ANOMALY_THRESHOLD = 0.25; // 25% above the historical average
const LARGE_TXN_MULTIPLE = 2.5; // 2.5x a merchant's typical transaction

export function detectCategoryAnomalies(current: CategoryTotal[], historicalAverage: Map<string, number>): Insight[] {
  const insights: Insight[] = [];
  for (const cat of current) {
    const avg = historicalAverage.get(cat.categoryName);
    if (!avg || avg <= 0) continue;
    const changePct = (cat.total - avg) / avg;
    if (changePct >= CATEGORY_ANOMALY_THRESHOLD) {
      insights.push({
        type: "category_above_average",
        title: "Higher than usual",
        message: `${cat.categoryName} spending is currently ${Math.round(changePct * 100)}% above your recent average.`,
      });
    }
  }
  return insights;
}

export function detectLargeTransactions(
  transactions: AnalyzableTransaction[],
  merchantAverages: Map<string, number>,
): Insight[] {
  const insights: Insight[] = [];
  for (const t of transactions.filter(countsAsSpend)) {
    const avg = merchantAverages.get(t.normalizedMerchant);
    if (!avg || avg <= 0) continue;
    if (Math.abs(t.amount) >= avg * LARGE_TXN_MULTIPLE) {
      insights.push({
        type: "large_transaction",
        title: "Large transaction",
        message: `A $${Math.abs(t.amount).toFixed(2)} ${t.normalizedMerchant} purchase is significantly larger than your normal ${t.normalizedMerchant} transaction.`,
      });
    }
  }
  return insights;
}

export function detectPossibleDuplicates(transactions: AnalyzableTransaction[]): Insight[] {
  const insights: Insight[] = [];
  const byKey = new Map<string, AnalyzableTransaction[]>();
  for (const t of transactions.filter(countsAsSpend)) {
    const key = `${t.normalizedMerchant}|${Math.round(Math.abs(t.amount) * 100)}|${t.transactionDate}`;
    const list = byKey.get(key) ?? [];
    list.push(t);
    byKey.set(key, list);
  }
  for (const [, group] of byKey) {
    if (group.length > 1) {
      insights.push({
        type: "possible_duplicate",
        title: "Possible duplicate",
        message: `Two $${Math.abs(group[0].amount).toFixed(2)} charges from ${group[0].normalizedMerchant} occurred on the same day — worth reviewing.`,
      });
    }
  }
  return insights;
}
