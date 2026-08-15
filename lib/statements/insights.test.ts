import { describe, expect, it } from "vitest";
import { categoryTotals, countsAsSpend, monthlySummary, type AnalyzableTransaction } from "./insights";

function txn(overrides: Partial<AnalyzableTransaction>): AnalyzableTransaction {
  return {
    id: "1",
    transactionDate: "2026-07-10",
    amount: -50,
    direction: "outflow",
    normalizedMerchant: "Test Merchant",
    categoryName: "Shopping",
    spendingTag: null,
    isExcluded: false,
    isTransfer: false,
    isCreditCardPayment: false,
    isIncome: false,
    isRecurring: false,
    ...overrides,
  };
}

describe("countsAsSpend / category totals", () => {
  it("excludes transfers from spending totals", () => {
    const t = txn({ isTransfer: true });
    expect(countsAsSpend(t)).toBe(false);
  });

  it("excludes credit-card payments from spending totals (no double-counting)", () => {
    // A $1,243.17 checking outflow paying off a credit card should not be
    // counted as additional spending on top of the card's own purchases.
    const ccPayment = txn({ amount: -1243.17, isCreditCardPayment: true });
    const groceries = txn({ id: "2", amount: -220, categoryName: "Groceries" });
    const dining = txn({ id: "3", amount: -180, categoryName: "Dining" });

    const totals = categoryTotals([ccPayment, groceries, dining]);
    const totalSpend = totals.reduce((s, c) => s + c.total, 0);
    expect(totalSpend).toBe(400); // groceries + dining only, not the CC payment
  });

  it("excludes user-excluded transactions", () => {
    expect(countsAsSpend(txn({ isExcluded: true }))).toBe(false);
  });

  it("computes income, spending, and surplus for a monthly summary", () => {
    const summary = monthlySummary([
      txn({ id: "1", direction: "inflow", isIncome: true, amount: 3000, categoryName: "Income" }),
      txn({ id: "2", amount: -1000, categoryName: "Housing" }),
      txn({ id: "3", amount: -200, categoryName: "Groceries" }),
    ]);
    expect(summary.income).toBe(3000);
    expect(summary.spending).toBe(1200);
    expect(summary.surplus).toBe(1800);
    expect(summary.savingsRate).toBeCloseTo(0.6, 5);
  });
});
