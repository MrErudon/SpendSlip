/**
 * Suggested-budget engine (docs/statement-import-expansion-plan.md §13).
 * Pure function over already-aggregated historical monthly category
 * totals — never writes anything or overwrites a user's existing budget;
 * the caller decides whether to persist the result (only on explicit
 * "Accept Suggested Budget").
 */

export interface SuggestedBudgetLine {
  categoryName: string;
  suggestedAmount: number;
  monthsObserved: number;
}

export interface SuggestedBudget {
  lines: SuggestedBudgetLine[];
  totalSuggestedSpend: number;
  suggestedSavings: number;
  suggestedBuffer: number;
  monthsOfData: number;
  confidence: "low" | "medium" | "high";
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * @param monthlyTotalsByCategory category name -> one total per observed
 *   month (any length >= 1; more months -> better confidence).
 * @param averageMonthlyIncome net income average, used to size the
 *   Savings/Buffer lines from whatever's left after suggested spending.
 */
export function generateSuggestedBudget(
  monthlyTotalsByCategory: Map<string, number[]>,
  averageMonthlyIncome: number,
): SuggestedBudget {
  const lines: SuggestedBudgetLine[] = [];
  let monthsOfData = 1;

  for (const [categoryName, totals] of monthlyTotalsByCategory) {
    if (totals.length === 0) continue;
    monthsOfData = Math.max(monthsOfData, totals.length);
    const average = totals.reduce((s, v) => s + v, 0) / totals.length;
    if (average <= 0) continue;
    lines.push({
      categoryName,
      suggestedAmount: roundToNearest(average, 5),
      monthsObserved: totals.length,
    });
  }

  lines.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
  const totalSuggestedSpend = lines.reduce((s, l) => s + l.suggestedAmount, 0);
  const leftover = Math.max(0, averageMonthlyIncome - totalSuggestedSpend);

  const confidence: SuggestedBudget["confidence"] = monthsOfData >= 3 ? "high" : monthsOfData === 2 ? "medium" : "low";

  return {
    lines,
    totalSuggestedSpend,
    suggestedSavings: roundToNearest(leftover * 0.75, 5),
    suggestedBuffer: roundToNearest(leftover * 0.25, 5),
    monthsOfData,
    confidence,
  };
}
