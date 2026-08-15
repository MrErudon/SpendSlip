import { describe, expect, it } from "vitest";
import { computeFingerprint } from "./transaction-fingerprint";

describe("computeFingerprint", () => {
  const base = {
    financialAccountId: "acct-1",
    amount: -45.99,
    transactionDate: "2026-07-15",
    normalizedDescription: "Joe's Coffee",
  };

  it("produces the same fingerprint for identical transactions", () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base }));
  });

  it("is case- and whitespace-insensitive on the description", () => {
    expect(computeFingerprint(base)).toBe(
      computeFingerprint({ ...base, normalizedDescription: "  joe's   coffee  " }),
    );
  });

  it("changes when the amount differs by a cent", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, amount: -46.0 }));
  });

  it("changes when the date differs", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, transactionDate: "2026-07-16" }));
  });

  it("changes when the account differs", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, financialAccountId: "acct-2" }));
  });

  it("changes when the description is meaningfully different", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, normalizedDescription: "Amazon" }));
  });
});
