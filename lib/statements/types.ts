import type { TransactionType } from "@/lib/types-financial";

/** A parsed row after fingerprinting, dedupe-checking, and initial
 * categorization — what the parse endpoint returns and the preview UI
 * edits before the user confirms import. */
export interface PreviewRow {
  /** Client-side key only; not persisted. */
  key: string;
  transactionDate: string;
  postedDate: string | null;
  rawDescription: string;
  normalizedMerchant: string;
  amount: number;
  direction: "inflow" | "outflow";
  transactionType: TransactionType;
  categoryName: string | null;
  needsReview: boolean;
  isTransferGuess: boolean;
  fingerprint: string;
  isDuplicate: boolean;
  excluded: boolean;
}

export interface ParsePreviewResponse {
  ok: boolean;
  failureReason?: string;
  filename: string;
  detectedProvider: string | null;
  dateRange: { start: string; end: string } | null;
  rows: PreviewRow[];
  duplicateCount: number;
  warnings: string[];
}

export interface ImportRequestRow {
  transactionDate: string;
  postedDate: string | null;
  rawDescription: string;
  normalizedMerchant: string;
  amount: number;
  direction: "inflow" | "outflow";
  transactionType: TransactionType;
  categoryName: string | null;
  needsReview: boolean;
  isTransferGuess: boolean;
}

export interface ImportResponse {
  ok: boolean;
  error?: string;
  statementImportId?: string;
  imported: number;
  skippedDuplicates: number;
}
