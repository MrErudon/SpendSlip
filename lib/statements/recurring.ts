import type { RecurringFrequency } from "@/lib/types-financial";

/**
 * Recurring/subscription detection (docs/statement-import-expansion-plan.md §10).
 *
 * Pure, deterministic, and unit-testable: given a flat list of outflow
 * transactions, groups by normalized merchant + similar amount, then
 * checks whether the intervals between occurrences are regular enough to
 * match one of the supported cadences. No DB/network access here — the
 * caller (an API route) fetches transactions, calls this, then persists
 * `recurring_groups` rows and flips `transactions.is_recurring`.
 */

export interface RecurringTransactionInput {
  id: string;
  normalizedMerchant: string;
  amount: number; // signed; only outflows (negative) are considered
  transactionDate: string; // ISO date
}

export interface RecurringCandidate {
  normalizedMerchant: string;
  estimatedAmount: number; // positive magnitude
  frequency: RecurringFrequency;
  nextExpectedDate: string;
  confidenceScore: number; // 0-1
  transactionIds: string[];
}

const FREQUENCY_DAYS: Record<RecurringFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30.4,
  quarterly: 91.3,
  semiannual: 182.6,
  annual: 365,
};
// Ordered narrowest-period-first so a close call prefers the shorter cadence.
const FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"];

const INTERVAL_TOLERANCE = 0.2; // +/-20% of the expected period length
const AMOUNT_TOLERANCE = 0.08; // +/-8% of the median amount
const MIN_OCCURRENCES = 2;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(a: string, b: string): number {
  return (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Best-fit cadence for a sequence of day-gaps, or null if none fit within tolerance. */
function bestFrequency(intervals: number[]): { frequency: RecurringFrequency; consistency: number } | null {
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;

  let best: { frequency: RecurringFrequency; consistency: number } | null = null;
  for (const freq of FREQUENCIES) {
    const expected = FREQUENCY_DAYS[freq];
    const deviation = Math.abs(avg - expected) / expected;
    if (deviation > INTERVAL_TOLERANCE) continue;

    const maxDelta = Math.max(...intervals.map((v) => Math.abs(v - expected))) / expected;
    const consistency = Math.max(0, 1 - maxDelta);
    if (!best || consistency > best.consistency) {
      best = { frequency: freq, consistency };
    }
  }
  return best;
}

export function detectRecurringGroups(transactions: RecurringTransactionInput[]): RecurringCandidate[] {
  const outflows = transactions.filter((t) => t.amount < 0);

  const byMerchant = new Map<string, RecurringTransactionInput[]>();
  for (const t of outflows) {
    const key = t.normalizedMerchant.trim().toLowerCase();
    if (!key) continue;
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [, group] of byMerchant) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const med = median(amounts);
    if (med === 0) continue;

    // Keep only occurrences whose amount is consistent with the median —
    // a one-off larger/smaller charge from the same merchant shouldn't
    // drag down interval detection or the estimated amount.
    const consistent = sorted.filter((t) => Math.abs(Math.abs(t.amount) - med) / med <= AMOUNT_TOLERANCE);
    if (consistent.length < MIN_OCCURRENCES) continue;

    const intervals: number[] = [];
    for (let i = 1; i < consistent.length; i++) {
      intervals.push(daysBetween(consistent[i - 1].transactionDate, consistent[i].transactionDate));
    }

    const match = bestFrequency(intervals);
    if (!match) continue;

    const occurrenceBoost = Math.min(1, consistent.length / 5); // more history = more confidence, caps at 5 occurrences
    const confidenceScore = Math.round(match.consistency * 0.7 * 100 + occurrenceBoost * 30) / 100;

    const lastDate = consistent[consistent.length - 1].transactionDate;
    candidates.push({
      normalizedMerchant: consistent[0].normalizedMerchant,
      estimatedAmount: median(consistent.map((t) => Math.abs(t.amount))),
      frequency: match.frequency,
      nextExpectedDate: addDays(lastDate, FREQUENCY_DAYS[match.frequency]),
      confidenceScore: Math.min(0.98, confidenceScore),
      transactionIds: consistent.map((t) => t.id),
    });
  }

  return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/** Annualized cost for display, e.g. "$22.99/mo -> $275.88/year". */
export function annualCost(amount: number, frequency: RecurringFrequency): number {
  const periodsPerYear = 365 / FREQUENCY_DAYS[frequency];
  return amount * periodsPerYear;
}

export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  return annualCost(amount, frequency) / 12;
}
