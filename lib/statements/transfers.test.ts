import { describe, expect, it } from "vitest";
import { findTransferMatches, type TransferCandidate } from "./transfers";

describe("findTransferMatches", () => {
  it("matches an opposite-signed, equal-magnitude pair across two accounts", () => {
    const candidates: TransferCandidate[] = [
      { id: "checking-out", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: -500 },
      { id: "savings-in", financialAccountId: "savings", accountType: "savings", transactionDate: "2026-07-11", amount: 500 },
    ];
    const matches = findTransferMatches(candidates);
    expect(matches).toHaveLength(1);
    expect(new Set([matches[0].aId, matches[0].bId])).toEqual(new Set(["checking-out", "savings-in"]));
    expect(matches[0].isCreditCardPayment).toBe(false);
  });

  it("flags a credit-card payment when one side is a credit_card account", () => {
    const candidates: TransferCandidate[] = [
      { id: "checking-out", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: -1243.17 },
      { id: "cc-payment", financialAccountId: "amex", accountType: "credit_card", transactionDate: "2026-07-10", amount: 1243.17 },
    ];
    const matches = findTransferMatches(candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].isCreditCardPayment).toBe(true);
  });

  it("does not match two transactions on the same account", () => {
    const candidates: TransferCandidate[] = [
      { id: "a", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: -500 },
      { id: "b", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: 500 },
    ];
    expect(findTransferMatches(candidates)).toHaveLength(0);
  });

  it("does not match amounts that differ", () => {
    const candidates: TransferCandidate[] = [
      { id: "a", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: -500 },
      { id: "b", financialAccountId: "savings", accountType: "savings", transactionDate: "2026-07-10", amount: 499.5 },
    ];
    expect(findTransferMatches(candidates)).toHaveLength(0);
  });

  it("does not match pairs outside the date window", () => {
    const candidates: TransferCandidate[] = [
      { id: "a", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-01", amount: -500 },
      { id: "b", financialAccountId: "savings", accountType: "savings", transactionDate: "2026-07-20", amount: 500 },
    ];
    expect(findTransferMatches(candidates)).toHaveLength(0);
  });

  it("leaves an unmatched candidate alone rather than forcing a match", () => {
    const candidates: TransferCandidate[] = [
      { id: "a", financialAccountId: "checking", accountType: "checking", transactionDate: "2026-07-10", amount: -500 },
    ];
    expect(findTransferMatches(candidates)).toHaveLength(0);
  });
});
