/**
 * Provider-agnostic statement parsing entry point. Dispatches by file
 * type; every source format normalizes to the same `ParsedStatement`
 * shape so nothing downstream (import preview, dedupe, categorization)
 * needs to know whether a file was a CSV or a PDF.
 */

import { parseCsvStatement } from "./csv-parser";
import { parsePdfStatement } from "./pdf-parser";
import { detectProvider } from "./detect-provider";

export interface RawStatementRow {
  transactionDate: string; // ISO YYYY-MM-DD
  postedDate: string | null;
  rawDescription: string;
  /** Signed: negative = money leaving the account (outflow), positive = inflow. */
  amount: number;
  direction: "inflow" | "outflow";
}

export interface ParsedStatement {
  ok: boolean;
  rows: RawStatementRow[];
  detectedProvider: string | null;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
  /** Set when ok is false — shown to the user verbatim. */
  failureReason?: string;
}

function emptyResult(reason: string): ParsedStatement {
  return { ok: false, rows: [], detectedProvider: null, dateRange: null, warnings: [], failureReason: reason };
}

export function dateRangeOf(rows: RawStatementRow[]): { start: string; end: string } | null {
  if (rows.length === 0) return null;
  const dates = rows.map((r) => r.transactionDate).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Parses a statement file (CSV or PDF) into normalized rows. CSV is the
 * reliable path with a provider-agnostic header-sniffing column mapper;
 * PDF is best-effort text extraction and returns `ok: false` rather than
 * guessing when it can't find a confident transaction pattern.
 */
export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";

  if (!isCsv && !isPdf) {
    return emptyResult("Unsupported file type. Upload a .csv or .pdf statement.");
  }

  const result = isCsv ? await parseCsvStatement(file) : await parsePdfStatement(file);
  if (!result.ok || result.rows.length === 0) {
    return result.ok ? emptyResult("No transactions were found in this file.") : result;
  }

  return {
    ...result,
    detectedProvider: result.detectedProvider ?? detectProvider(file.name, result.rows),
    dateRange: dateRangeOf(result.rows),
  };
}
