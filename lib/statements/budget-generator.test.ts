import { describe, expect, it } from "vitest";
import { generateSuggestedBudget } from "./budget-generator";

describe("generateSuggestedBudget", () => {
  it("averages historical monthly totals per category", () => {
    const totals = new Map([
      ["Groceries", [480, 520, 500]],
      ["Dining", [300, 340, 320]],
    ]);
    const budget = generateSuggestedBudget(totals, 6000);
    const groceries = budget.lines.find((l) => l.categoryName === "Groceries");
    const dining = budget.lines.find((l) => l.categoryName === "Dining");
    expect(groceries?.suggestedAmount).toBe(500); // average of 480/520/500, rounded to nearest 5
    expect(dining?.suggestedAmount).toBe(320);
  });

  it("reports low confidence with a single month of data", () => {
    const budget = generateSuggestedBudget(new Map([["Groceries", [500]]]), 6000);
    expect(budget.confidence).toBe("low");
    expect(budget.monthsOfData).toBe(1);
  });

  it("reports high confidence with 3+ months of data", () => {
    const budget = generateSuggestedBudget(new Map([["Groceries", [480, 520, 500]]]), 6000);
    expect(budget.confidence).toBe("high");
  });

  it("allocates leftover income to savings and buffer without exceeding income", () => {
    const budget = generateSuggestedBudget(new Map([["Groceries", [500]]]), 1000);
    expect(budget.suggestedSavings + budget.suggestedBuffer + budget.totalSuggestedSpend).toBeLessThanOrEqual(1000 + 5);
  });

  it("never suggests negative savings/buffer when spending exceeds income", () => {
    const budget = generateSuggestedBudget(new Map([["Housing", [5000]]]), 1000);
    expect(budget.suggestedSavings).toBe(0);
    expect(budget.suggestedBuffer).toBe(0);
  });
});
