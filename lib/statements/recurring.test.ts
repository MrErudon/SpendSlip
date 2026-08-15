import { describe, expect, it } from "vitest";
import { annualCost, detectRecurringGroups, monthlyEquivalent, type RecurringTransactionInput } from "./recurring";

function monthlyCharge(id: string, month: number, day: string, amount = -22.99): RecurringTransactionInput {
  return { id, normalizedMerchant: "Netflix", amount, transactionDate: `2026-${String(month).padStart(2, "0")}-${day}` };
}

describe("detectRecurringGroups", () => {
  it("detects a monthly subscription from three regular charges", () => {
    const txns = [monthlyCharge("1", 4, "15"), monthlyCharge("2", 5, "15"), monthlyCharge("3", 6, "15")];
    const candidates = detectRecurringGroups(txns);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].normalizedMerchant).toBe("Netflix");
    expect(candidates[0].frequency).toBe("monthly");
    expect(candidates[0].estimatedAmount).toBeCloseTo(22.99, 2);
    expect(candidates[0].transactionIds).toEqual(["1", "2", "3"]);
  });

  it("ignores merchants with only a single occurrence", () => {
    const txns = [monthlyCharge("1", 4, "15")];
    expect(detectRecurringGroups(txns)).toHaveLength(0);
  });

  it("ignores irregular, non-periodic charges from the same merchant", () => {
    const txns: RecurringTransactionInput[] = [
      { id: "1", normalizedMerchant: "Corner Store", amount: -12, transactionDate: "2026-01-03" },
      { id: "2", normalizedMerchant: "Corner Store", amount: -18, transactionDate: "2026-01-19" },
      { id: "3", normalizedMerchant: "Corner Store", amount: -9, transactionDate: "2026-02-27" },
    ];
    expect(detectRecurringGroups(txns)).toHaveLength(0);
  });

  it("ignores inflow (positive amount) transactions", () => {
    const txns: RecurringTransactionInput[] = [
      { id: "1", normalizedMerchant: "Refund Co", amount: 20, transactionDate: "2026-01-01" },
      { id: "2", normalizedMerchant: "Refund Co", amount: 20, transactionDate: "2026-02-01" },
    ];
    expect(detectRecurringGroups(txns)).toHaveLength(0);
  });

  it("detects a weekly cadence", () => {
    const txns: RecurringTransactionInput[] = [
      { id: "1", normalizedMerchant: "Meal Kit", amount: -60, transactionDate: "2026-01-05" },
      { id: "2", normalizedMerchant: "Meal Kit", amount: -60, transactionDate: "2026-01-12" },
      { id: "3", normalizedMerchant: "Meal Kit", amount: -60, transactionDate: "2026-01-19" },
    ];
    expect(detectRecurringGroups(txns)[0].frequency).toBe("weekly");
  });
});

describe("annualCost / monthlyEquivalent", () => {
  it("annualizes a monthly subscription correctly", () => {
    expect(annualCost(22.99, "monthly")).toBeCloseTo(275.88, 1);
  });

  it("monthlyEquivalent of an annual charge divides by 12", () => {
    expect(monthlyEquivalent(120, "annual")).toBeCloseTo(10, 1);
  });
});
