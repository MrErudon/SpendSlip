import type { RawStatementRow } from "./parser";

/**
 * Best-effort institution label for display only (e.g. "Chase detected"
 * on the import card). Never used to branch parsing logic — the parsers
 * themselves stay provider-agnostic.
 */
const PROVIDER_FILENAME_HINTS: [RegExp, string][] = [
  [/chase/i, "Chase"],
  [/amex|american.?express/i, "American Express"],
  [/capital.?one/i, "Capital One"],
  [/bank.?of.?america|boa[_-]/i, "Bank of America"],
  [/wells.?fargo/i, "Wells Fargo"],
  [/citi(bank)?/i, "Citi"],
  [/discover/i, "Discover"],
  [/usbank|us.?bank/i, "U.S. Bank"],
  [/pnc/i, "PNC"],
  [/ally/i, "Ally"],
  [/schwab/i, "Charles Schwab"],
  [/fidelity/i, "Fidelity"],
];

export function detectProvider(filename: string, rows: RawStatementRow[]): string | null {
  for (const [pattern, name] of PROVIDER_FILENAME_HINTS) {
    if (pattern.test(filename)) return name;
  }

  const sample = rows
    .slice(0, 20)
    .map((r) => r.rawDescription)
    .join(" ");
  for (const [pattern, name] of PROVIDER_FILENAME_HINTS) {
    if (pattern.test(sample)) return name;
  }

  return null;
}
