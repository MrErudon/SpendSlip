import { describe, expect, it } from "vitest";
import { forecastMonthEnd } from "./forecast";

describe("forecastMonthEnd", () => {
  it("sums spent-so-far, remaining bills, and projected discretionary into the month total", () => {
    const result = forecastMonthEnd({
      spentSoFar: 3810,
      expectedRemainingBills: 1420,
      discretionarySpentSoFar: 400,
      historicalMonthlyDiscretionaryAverage: 900,
      expectedIncome: 6520,
      daysElapsedInMonth: 20,
      daysInMonth: 30,
    });
    expect(result.projectedMonthTotal).toBe(result.spentSoFar + result.expectedRemainingBills + result.expectedRemainingDiscretionary);
    expect(result.projectedSurplus).toBe(result.expectedIncome - result.projectedMonthTotal);
  });

  it("projects zero remaining discretionary spend with no history and no days left", () => {
    const result = forecastMonthEnd({
      spentSoFar: 2000,
      expectedRemainingBills: 0,
      discretionarySpentSoFar: 0,
      historicalMonthlyDiscretionaryAverage: 0,
      expectedIncome: 3000,
      daysElapsedInMonth: 30,
      daysInMonth: 30,
    });
    expect(result.expectedRemainingDiscretionary).toBe(0);
    expect(result.projectedMonthTotal).toBe(2000);
  });

  it("uses the higher of pace-based and average-based projections", () => {
    // Already spent well above the historical monthly average early in the
    // month -> the pace estimate should dominate, not the (already
    // exhausted) average-based remainder.
    const result = forecastMonthEnd({
      spentSoFar: 100,
      expectedRemainingBills: 0,
      discretionarySpentSoFar: 800, // already over the "average"
      historicalMonthlyDiscretionaryAverage: 600,
      expectedIncome: 5000,
      daysElapsedInMonth: 5,
      daysInMonth: 30,
    });
    // remainingAgainstAverage would be 0 (already over), so pace must win.
    expect(result.expectedRemainingDiscretionary).toBeGreaterThan(0);
  });

  it("always returns a human-readable explanation", () => {
    const result = forecastMonthEnd({
      spentSoFar: 100,
      expectedRemainingBills: 0,
      discretionarySpentSoFar: 0,
      historicalMonthlyDiscretionaryAverage: 0,
      expectedIncome: 1000,
      daysElapsedInMonth: 10,
      daysInMonth: 30,
    });
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});
