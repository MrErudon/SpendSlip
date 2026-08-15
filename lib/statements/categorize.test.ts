import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "./categorize";
import type { MerchantRule } from "@/lib/types-financial";

function rule(overrides: Partial<MerchantRule> = {}): MerchantRule {
  return {
    id: "rule-1",
    user_id: "user-1",
    budget_profile_id: "profile-1",
    merchant_pattern: "costco",
    normalized_merchant: null,
    category_id: "cat-groceries",
    priority: 1,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("categorizeTransaction", () => {
  it("a user merchant rule overrides the built-in category", () => {
    // Built-in categorize.ts maps Costco -> Shopping by default via
    // keyword/merchant heuristics, but a user rule must win.
    const result = categorizeTransaction(
      { normalizedMerchant: "Costco", rawDescription: "COSTCO WHSE #123", amount: -85.4, direction: "outflow" },
      [rule()],
      new Map(),
    );
    expect(result.source).toBe("merchant_rule");
    expect(result.needsReview).toBe(false);
  });

  it("falls back to prior category history when no rule matches", () => {
    const result = categorizeTransaction(
      { normalizedMerchant: "Local Diner", rawDescription: "LOCAL DINER", amount: -22, direction: "outflow" },
      [],
      new Map([["local diner", "Dining"]]),
    );
    expect(result.source).toBe("history");
    expect(result.categoryName).toBe("Dining");
  });

  it("recognizes income via keyword rules", () => {
    const result = categorizeTransaction(
      { normalizedMerchant: "Acme Corp Payroll", rawDescription: "ACME CORP PAYROLL DIRECT DEP", amount: 2500, direction: "inflow" },
      [],
      new Map(),
    );
    expect(result.isIncome).toBe(true);
    expect(result.transactionType).toBe("income");
  });

  it("flags transfer-looking descriptions for review rather than guessing silently", () => {
    const result = categorizeTransaction(
      { normalizedMerchant: "Transfer To Savings", rawDescription: "TRANSFER TO SAVINGS", amount: -500, direction: "outflow" },
      [],
      new Map(),
    );
    expect(result.isTransferGuess).toBe(true);
    expect(result.needsReview).toBe(true);
  });

  it("falls through to Needs Review when nothing matches", () => {
    const result = categorizeTransaction(
      { normalizedMerchant: "Some Random Shop", rawDescription: "SOME RANDOM SHOP", amount: -10, direction: "outflow" },
      [],
      new Map(),
    );
    expect(result.needsReview).toBe(true);
    expect(result.source).toBe("none");
  });
});
