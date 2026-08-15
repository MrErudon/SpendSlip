/**
 * Optional, narrowly-scoped AI assist for merchant normalization and
 * categorization (docs/statement-import-expansion-plan.md §9). Not a chat
 * interface, not wired into anything user-facing directly — it's the
 * last-resort step after merchant rules / history / built-in keywords in
 * lib/statements/categorize.ts, only called for rows still "Needs Review".
 *
 * Privacy contract:
 *  - Sends only a short transaction description string (e.g.
 *    "TST*BIG BURRITO 1452") and the list of valid category names.
 *  - Never sends full statements, account numbers, balances, or any
 *    user-identifying information.
 *  - Server-only — never imported from a Client Component.
 *  - No API key configured -> `classifyMerchant` resolves to `null`
 *    immediately and the app behaves exactly as if AI were absent.
 *
 * Provider-agnostic on purpose: callers depend only on this module's
 * function signature, not on a particular vendor SDK, so swapping the
 * implementation later doesn't ripple outward.
 */

export interface ClassifyResult {
  merchant: string;
  category: string;
}

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 8000;

export function isAiClassifierEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Classifies a single raw transaction description into a clean merchant
 * name plus one of `availableCategories`. Returns null on any failure,
 * timeout, or when no API key is configured — callers should always treat
 * that as "fall through to Needs Review", never as an error to surface.
 */
export async function classifyMerchant(
  rawDescription: string,
  availableCategories: string[],
): Promise<ClassifyResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content:
              `Bank transaction description: "${rawDescription}"\n\n` +
              `Categories: ${availableCategories.join(", ")}\n\n` +
              `Reply with ONLY a JSON object like {"merchant":"Clean Name","category":"OneOfTheCategories"}. ` +
              `No other text.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.content?.[0]?.text;
    if (!text) return null;

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<ClassifyResult>;
    if (!parsed.merchant || !parsed.category || !availableCategories.includes(parsed.category)) return null;

    return { merchant: parsed.merchant, category: parsed.category };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
