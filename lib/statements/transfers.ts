import type { AccountType } from "@/lib/types-financial";

/**
 * Transfer / credit-card-payment detection (docs/statement-import-expansion-plan.md §8).
 *
 * `findTransferMatches` is the pure, unit-tested core: given a pool of
 * "candidate" transactions (already flagged by lib/statements/categorize.ts
 * as looking like a transfer/payment, e.g. "TRANSFER TO SAVINGS" or
 * "PAYMENT THANK YOU"), it pairs opposite-signed, equal-magnitude
 * transactions on *different* accounts within a short date window — the
 * checking-account outflow and the savings/credit-card inflow are the
 * same real-world movement of money, not two separate spends.
 *
 * Unmatched candidates are left exactly as categorize.ts set them
 * (is_transfer/is_credit_card_payment guessed true, needs_review true) —
 * still excluded from spending totals by default, but visibly flagged for
 * the review queue rather than silently trusted. This commonly happens
 * when only one side's account has been imported yet; re-running the
 * matcher after a later import (see reconcileTransfers below) picks it up
 * once the counterpart statement lands.
 */

export interface TransferCandidate {
  id: string;
  financialAccountId: string;
  accountType: AccountType;
  transactionDate: string; // ISO date
  amount: number; // signed
}

export interface TransferMatch {
  aId: string;
  bId: string;
  isCreditCardPayment: boolean;
}

const MATCH_WINDOW_DAYS = 4;

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

/** Cents-precision comparison to avoid float drift. */
function centsEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export function findTransferMatches(candidates: TransferCandidate[]): TransferMatch[] {
  const sorted = [...candidates].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  const used = new Set<string>();
  const matches: TransferMatch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.id)) continue;
      if (daysBetween(a.transactionDate, b.transactionDate) > MATCH_WINDOW_DAYS) break; // sorted, no further j can match
      if (a.financialAccountId === b.financialAccountId) continue; // same account: not a transfer pair
      if (!centsEqual(a.amount, -b.amount)) continue; // must be opposite-signed, equal magnitude

      matches.push({
        aId: a.id,
        bId: b.id,
        isCreditCardPayment: a.accountType === "credit_card" || b.accountType === "credit_card",
      });
      used.add(a.id);
      used.add(b.id);
      break;
    }
  }

  return matches;
}
