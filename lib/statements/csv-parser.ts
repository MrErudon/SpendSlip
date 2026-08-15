import Papa from "papaparse";
import type { ParsedStatement, RawStatementRow } from "./parser";

/**
 * Provider-agnostic CSV column mapping. Bank/card CSV exports vary
 * wildly in header names, so this sniffs common header aliases instead
 * of hard-coding one institution's schema. CSV is the most reliable
 * import path — when a header can't be confidently mapped, this fails
 * loudly (`ok: false`) rather than guessing at financial data.
 */

const DATE_HEADERS = /^(transaction\s*date|trans\s*date|date)$/i;
const POSTED_HEADERS = /^(post(ed)?\s*date|posting\s*date)$/i;
const DESCRIPTION_HEADERS = /^(description|memo|payee|merchant|details|name)$/i;
const AMOUNT_HEADERS = /^amount$/i;
const DEBIT_HEADERS = /^(debit|withdrawal|withdrawals|payment)$/i;
const CREDIT_HEADERS = /^(credit|deposit|deposits)$/i;

function findHeader(headers: string[], pattern: RegExp): string | null {
  return headers.find((h) => pattern.test(h.trim())) ?? null;
}

function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // MM/DD/YYYY or M/D/YY
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function toAmount(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  // Accounting-style negatives: "(12.34)"
  const paren = cleaned.match(/^\((.+)\)$/);
  const normalized = paren ? `-${paren[1]}` : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export async function parseCsvStatement(file: File): Promise<ParsedStatement> {
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    return {
      ok: false,
      rows: [],
      detectedProvider: null,
      dateRange: null,
      warnings: [],
      failureReason: "This CSV file couldn't be read. Check that it's a plain comma-separated export.",
    };
  }

  const headers = parsed.meta.fields ?? [];
  const dateCol = findHeader(headers, DATE_HEADERS);
  const postedCol = findHeader(headers, POSTED_HEADERS);
  const descCol = findHeader(headers, DESCRIPTION_HEADERS);
  const amountCol = findHeader(headers, AMOUNT_HEADERS);
  const debitCol = findHeader(headers, DEBIT_HEADERS);
  const creditCol = findHeader(headers, CREDIT_HEADERS);

  if (!dateCol || !descCol || (!amountCol && !debitCol && !creditCol)) {
    return {
      ok: false,
      rows: [],
      detectedProvider: null,
      dateRange: null,
      warnings: [],
      failureReason:
        "Couldn't find date, description, and amount columns in this CSV. Expected headers like Date, Description, and Amount (or Debit/Credit).",
    };
  }

  const rows: RawStatementRow[] = [];
  const warnings: string[] = [];

  for (const [i, record] of parsed.data.entries()) {
    const date = toIsoDate(record[dateCol] ?? "");
    const description = (record[descCol] ?? "").trim();
    if (!date || !description) {
      warnings.push(`Row ${i + 2}: skipped (missing date or description).`);
      continue;
    }

    let amount: number | null = null;
    if (amountCol) {
      amount = toAmount(record[amountCol] ?? "");
    } else {
      const debit = debitCol ? toAmount(record[debitCol] ?? "") : null;
      const credit = creditCol ? toAmount(record[creditCol] ?? "") : null;
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    }
    if (amount === null || amount === 0) {
      warnings.push(`Row ${i + 2}: skipped (couldn't read an amount).`);
      continue;
    }

    const posted = postedCol ? toIsoDate(record[postedCol] ?? "") : null;

    rows.push({
      transactionDate: date,
      postedDate: posted,
      rawDescription: description,
      amount,
      direction: amount < 0 ? "outflow" : "inflow",
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      rows: [],
      detectedProvider: null,
      dateRange: null,
      warnings,
      failureReason: "No usable transaction rows were found in this file.",
    };
  }

  return { ok: true, rows, detectedProvider: null, dateRange: null, warnings };
}
