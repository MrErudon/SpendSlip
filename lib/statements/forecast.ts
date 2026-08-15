/**
 * Simple, transparent month-end forecasting (docs/statement-import-expansion-plan.md §14).
 * Every input and intermediate number is returned alongside the result so
 * the UI can show "how this was calculated" rather than a black box.
 */

export interface ForecastInput {
  /** Sum of this month's counted spending so far. */
  spentSoFar: number;
  /** Unpaid bill_occurrences still due this month. */
  expectedRemainingBills: number;
  /** This month's discretionary spend so far (subset of spentSoFar). */
  discretionarySpentSoFar: number;
  /** Average monthly discretionary spend over recent history. */
  historicalMonthlyDiscretionaryAverage: number;
  /** Expected income for the month (received + remaining scheduled paychecks). */
  expectedIncome: number;
  daysElapsedInMonth: number;
  daysInMonth: number;
}

export interface ForecastResult {
  spentSoFar: number;
  expectedRemainingBills: number;
  expectedRemainingDiscretionary: number;
  projectedMonthTotal: number;
  expectedIncome: number;
  projectedSurplus: number;
  /** Human-readable steps, shown behind an expandable "how this was calculated". */
  explanation: string[];
}

export function forecastMonthEnd(input: ForecastInput): ForecastResult {
  const daysRemaining = Math.max(0, input.daysInMonth - input.daysElapsedInMonth);

  const dailyDiscretionaryRate =
    input.historicalMonthlyDiscretionaryAverage > 0 ? input.historicalMonthlyDiscretionaryAverage / 30.4 : 0;
  const paceProjection = dailyDiscretionaryRate * daysRemaining;

  // Two independent estimates, take the larger (more conservative) one:
  //  - pace: recent daily discretionary rate x days left
  //  - budget: however much of a "typical month" hasn't been spent yet
  // If the user is already tracking ahead of their historical average,
  // the pace estimate dominates rather than assuming they'll slow down.
  const remainingAgainstAverage = Math.max(0, input.historicalMonthlyDiscretionaryAverage - input.discretionarySpentSoFar);
  const expectedRemainingDiscretionary = Math.max(paceProjection, remainingAgainstAverage);

  const projectedMonthTotal = input.spentSoFar + input.expectedRemainingBills + expectedRemainingDiscretionary;
  const projectedSurplus = input.expectedIncome - projectedMonthTotal;

  return {
    spentSoFar: input.spentSoFar,
    expectedRemainingBills: input.expectedRemainingBills,
    expectedRemainingDiscretionary: Math.round(expectedRemainingDiscretionary),
    projectedMonthTotal: Math.round(input.spentSoFar + input.expectedRemainingBills + expectedRemainingDiscretionary),
    expectedIncome: input.expectedIncome,
    projectedSurplus: Math.round(projectedSurplus),
    explanation: [
      `Spent so far this month: $${input.spentSoFar.toFixed(2)}`,
      `+ Remaining known bills: $${input.expectedRemainingBills.toFixed(2)}`,
      `+ Projected remaining discretionary spending (${daysRemaining} days left, based on your recent daily pace): $${expectedRemainingDiscretionary.toFixed(2)}`,
      `= Projected month total: $${projectedMonthTotal.toFixed(2)}`,
      `Expected income this month: $${input.expectedIncome.toFixed(2)}`,
      `Projected surplus: $${projectedSurplus.toFixed(2)}`,
    ],
  };
}
