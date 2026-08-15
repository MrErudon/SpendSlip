import { PDFParse } from "pdf-parse";
import type { ParsedStatement, RawStatementRow } from "./parser";

/**
 * Best-effort PDF statement parsing. There is no single reliable format
 * for bank/card statement PDFs, so this extracts raw text and applies a
 * line-based heuristic (leading date, trailing amount). When too few
 * lines match with confidence, it fails loudly (`ok: false`) instead of
 * importing a partial or wrong transaction list — the UI then tells the
 * user to try a CSV export or enter transactions manually.
 */

// "07/15" or "07/15/2026" or "07/15/26" at the start of a line.
const LEADING_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+/;
// A trailing dollar amount, optionally negative or parenthesized, at the
// end of a line — e.g. "45.99", "-45.99", "$45.99", "(45.99)".
const TRAILING_AMOUNT = /\$?\(?-?\$?([\d,]+\.\d{2})\)?\s*$/;

const MIN_CONFIDENT_ROWS = 3;
const MIN_MATCH_RATIO = 0.3;

function toIsoDate(month: string, day: string, year: string | undefined, fallbackYear: number): string {
  const y = year ? (year.length === 2 ? `20${year}` : year) : String(fallbackYear);
  return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseAmount(raw: string, negativeHint: boolean): number {
  const n = Number(raw.replace(/,/g, ""));
  return negativeHint ? -Math.abs(n) : n;
}

export async function parsePdfStatement(file: File): Promise<ParsedStatement> {
  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text;
  } catch {
    return {
      ok: false,
      rows: [],
      detectedProvider: null,
      dateRange: null,
      warnings: [],
      failureReason: "This PDF couldn't be opened. It may be scanned, image-based, or password protected.",
    };
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const fallbackYear = new Date().getFullYear();
  const rows: RawStatementRow[] = [];
  let candidateLines = 0;

  for (const line of lines) {
    const dateMatch = line.match(LEADING_DATE);
    if (!dateMatch) continue;

    const amountMatch = line.match(TRAILING_AMOUNT);
    if (!amountMatch) continue;

    candidateLines++;

    const [, month, day, year] = dateMatch;
    const date = toIsoDate(month, day, year, fallbackYear);
    const isNegative = /-\$?[\d,]+\.\d{2}\)?\s*$/.test(line) || /^\(.*\)$/.test(amountMatch[0].trim());
    const amount = parseAmount(amountMatch[1], isNegative);

    const description = line.slice(dateMatch[0].length, line.length - amountMatch[0].length).trim();
    if (!description || amount === 0) continue;

    rows.push({
      transactionDate: date,
      postedDate: null,
      rawDescription: description,
      amount,
      direction: amount < 0 ? "outflow" : "inflow",
    });
  }

  const matchRatio = lines.length > 0 ? candidateLines / lines.length : 0;
  if (rows.length < MIN_CONFIDENT_ROWS || matchRatio < MIN_MATCH_RATIO) {
    return {
      ok: false,
      rows: [],
      detectedProvider: null,
      dateRange: null,
      warnings: [],
      failureReason:
        "This statement format could not be parsed automatically. Try exporting a CSV from your bank instead, or enter transactions manually.",
    };
  }

  return {
    ok: true,
    rows,
    detectedProvider: null,
    dateRange: null,
    warnings: ["Parsed from PDF text — double-check amounts and dates before importing."],
  };
}
