/**
 * Merchant normalization pipeline.
 *
 * Order (see docs/statement-import-expansion-plan.md §6):
 *   1. deterministic cleaning rules (this file, `cleanDescription`)
 *   2. known merchant aliases (this file, `KNOWN_MERCHANT_ALIASES`)
 *   3. user-defined merchant rules (lib/statements/categorize.ts, DB-backed)
 *   4. optional AI fallback (lib/ai/financial-classifier.ts)
 *
 * `normalizeMerchant` performs steps 1-2 and is pure/deterministic, so the
 * app stays fully useful with no AI configured. The raw description is
 * never mutated — callers store both `raw_description` and the result of
 * this function as `normalized_merchant`.
 */

// Point-of-sale / payment-processor prefixes that carry no merchant
// identity of their own.
const PROCESSOR_PREFIXES: RegExp[] = [
  /^SQ\s*\*\s*/i,
  /^TST\s*\*\s*/i,
  /^SP\s+/i,
  /^PAYPAL\s*\*\s*/i,
  /^PY\s*\*\s*/i,
  /^CKO\s*\*\s*/i,
  /^TOAST\s*\*\s*/i,
  /^CLOVER\s*\*\s*/i,
];

// description regex -> canonical merchant name. Ordered; first match wins.
const KNOWN_MERCHANT_ALIASES: [RegExp, string][] = [
  [/AMAZON|AMZN\s*MKTP/i, "Amazon"],
  [/WAL-?MART/i, "Walmart"],
  [/TARGET\s*T?-?\d*/i, "Target"],
  [/COSTCO\s*WHSE/i, "Costco"],
  [/TRADER\s*JOE/i, "Trader Joe's"],
  [/WHOLE\s*FOODS/i, "Whole Foods"],
  [/STARBUCKS/i, "Starbucks"],
  [/UBER\s*\*?\s*EATS/i, "Uber Eats"],
  [/UBER(?!\s*EATS)/i, "Uber"],
  [/LYFT/i, "Lyft"],
  [/DOORDASH|DD\s*\*DOORDASH/i, "DoorDash"],
  [/NETFLIX/i, "Netflix"],
  [/SPOTIFY/i, "Spotify"],
  [/HULU/i, "Hulu"],
  [/DISNEY\+?|DISNEYPLUS/i, "Disney+"],
  [/APPLE\.COM\/BILL|APPLE\s*SERVICES/i, "Apple"],
  [/GOOGLE\s*\*?\s*(YOUTUBE|GOOGLE)?/i, "Google"],
  [/SHELL\s*OIL|SHELL\s*#/i, "Shell"],
  [/CHEVRON/i, "Chevron"],
  [/EXXON|EXXONMOBIL/i, "ExxonMobil"],
  [/HOME\s*DEPOT/i, "The Home Depot"],
  [/LOWE'?S/i, "Lowe's"],
  [/CVS\s*\/?\s*PHARMACY|CVS\s*#/i, "CVS Pharmacy"],
  [/WALGREENS/i, "Walgreens"],
  [/BEST\s*BUY/i, "Best Buy"],
  [/CHIPOTLE/i, "Chipotle"],
  [/MCDONALD/i, "McDonald's"],
  [/PLANET\s*FITNESS/i, "Planet Fitness"],
  [/AT&T|ATT\s*\*BILL/i, "AT&T"],
  [/VERIZON/i, "Verizon"],
  [/T-?MOBILE/i, "T-Mobile"],
  [/COMCAST|XFINITY/i, "Comcast/Xfinity"],
  [/GEICO/i, "GEICO"],
  [/PROGRESSIVE/i, "Progressive"],
  [/STATE\s*FARM/i, "State Farm"],
];

/** Strips trailing store numbers, terminal IDs, and long digit runs. */
function stripTrailingNoise(description: string): string {
  return description
    .replace(/#?\d{3,}$/g, "") // trailing store/terminal numbers
    .replace(/\s*[*#]\s*[A-Z0-9]{4,}$/i, "") // trailing reference codes
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Deterministic cleaning: strip processor prefixes, city/state suffixes, noise. */
export function cleanDescription(raw: string): string {
  let s = raw.trim();
  for (const prefix of PROCESSOR_PREFIXES) {
    s = s.replace(prefix, "");
  }
  // Drop a trailing " CITY ST" or " CITY STATE" location suffix, e.g.
  // "JOES COFFEE SEATTLE WA" -> "JOES COFFEE".
  s = s.replace(/\s+[A-Z][A-Za-z.'\- ]{2,}\s+[A-Z]{2}$/, "");
  s = stripTrailingNoise(s);
  return s;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Pure, deterministic merchant normalization: raw statement text in,
 * a human-readable merchant name out. No network calls, no DB lookups —
 * those layer on top (see the module doc comment above).
 */
export function normalizeMerchant(rawDescription: string): string {
  const cleaned = cleanDescription(rawDescription);

  for (const [pattern, canonical] of KNOWN_MERCHANT_ALIASES) {
    if (pattern.test(cleaned) || pattern.test(rawDescription)) {
      return canonical;
    }
  }

  if (cleaned.length === 0) return titleCase(rawDescription.trim());

  // Apostrophe-containing brand names look wrong in ALL CAPS -> Title Case,
  // but leave already-mixed-case descriptions alone (some exports aren't
  // shouty and title-casing them would mangle acronyms).
  const isShouty = cleaned === cleaned.toUpperCase();
  return isShouty ? titleCase(cleaned) : cleaned;
}
