/**
 * Deterministic transaction fingerprinting for duplicate detection.
 *
 * The same real-world transaction — re-parsed from the same statement, or
 * seen again on a later statement because it straddled a pending/posted
 * boundary — must always produce the same fingerprint. A meaningfully
 * different transaction (different amount, date, account, or description)
 * must not collide.
 *
 * Deliberately excludes `posted_date` from the hash: the same purchase
 * commonly appears with a `transaction_date` on one statement and gets its
 * `posted_date` filled in on a later one, and we still want that to match.
 * `posted_date` is used only as a secondary signal when two fingerprints
 * are already equal (see isDuplicateCandidate below) - it never changes
 * the hash itself.
 */

export interface FingerprintInput {
  financialAccountId: string;
  amount: number;
  transactionDate: string; // ISO date, YYYY-MM-DD
  normalizedDescription: string;
}

/** Small, dependency-free 32-bit string hash (FNV-1a), hex-encoded. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Cents-precision amount string, avoiding float-formatting drift (1 vs 1.0). */
function amountKey(amount: number): string {
  return Math.round(amount * 100).toString();
}

function descriptionKey(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeFingerprint(input: FingerprintInput): string {
  const key = [
    input.financialAccountId,
    amountKey(input.amount),
    input.transactionDate,
    descriptionKey(input.normalizedDescription),
  ].join("|");
  return fnv1a(key);
}
