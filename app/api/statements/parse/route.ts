import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseStatementFile } from "@/lib/statements/parser";
import { normalizeMerchant } from "@/lib/statements/normalize";
import { computeFingerprint } from "@/lib/statements/transaction-fingerprint";
import { categorizeTransaction } from "@/lib/statements/categorize";
import { classifyMerchant, isAiClassifierEnabled } from "@/lib/ai/financial-classifier";
import type { ParsePreviewResponse, PreviewRow } from "@/lib/statements/types";
import type { MerchantRule } from "@/lib/types-financial";

// Bounds how many rows per import can hit the AI fallback — keeps latency
// and cost predictable on a large statement; the rest simply stay
// "Needs Review" for manual categorization, same as when AI is off.
const AI_FALLBACK_LIMIT = 25;

export const runtime = "nodejs";

/**
 * Parses an uploaded statement and returns an editable preview — never
 * writes anything to the database or Storage. Raw file bytes exist only
 * for the lifetime of this request; nothing is logged.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, failureReason: "Not signed in" } satisfies Partial<ParsePreviewResponse>, {
      status: 401,
    });
  }

  const form = await request.formData();
  const file = form.get("file");
  const financialAccountId = form.get("financial_account_id");
  if (!(file instanceof File) || typeof financialAccountId !== "string") {
    return NextResponse.json({ ok: false, failureReason: "Missing file or account." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id, budget_profile_id")
    .eq("id", financialAccountId)
    .single();
  if (!account) {
    return NextResponse.json({ ok: false, failureReason: "Account not found." }, { status: 404 });
  }
  const budgetProfileId = account.budget_profile_id as string;

  const parsed = await parseStatementFile(file);
  if (!parsed.ok) {
    return NextResponse.json({
      ok: false,
      failureReason: parsed.failureReason,
      filename: file.name,
      detectedProvider: null,
      dateRange: null,
      rows: [],
      duplicateCount: 0,
      warnings: parsed.warnings,
    } satisfies ParsePreviewResponse);
  }

  const [{ data: ruleRows }, { data: recentTxns }, { data: existingFingerprints }] = await Promise.all([
    supabase.from("merchant_rules").select("*").eq("budget_profile_id", budgetProfileId),
    supabase
      .from("transactions")
      .select("normalized_merchant, category_id, spending_categories(name)")
      .eq("budget_profile_id", budgetProfileId)
      .order("transaction_date", { ascending: false })
      .limit(1000),
    supabase.from("transactions").select("fingerprint").eq("financial_account_id", financialAccountId),
  ]);

  const merchantRules = (ruleRows ?? []) as MerchantRule[];
  const categoryHistory = new Map<string, string>();
  for (const t of (recentTxns ?? []) as unknown as { normalized_merchant: string; spending_categories: { name: string } | null }[]) {
    const key = t.normalized_merchant.toLowerCase();
    if (!categoryHistory.has(key) && t.spending_categories?.name) {
      categoryHistory.set(key, t.spending_categories.name);
    }
  }
  const existingFingerprintSet = new Set((existingFingerprints ?? []).map((r) => r.fingerprint as string));

  let duplicateCount = 0;
  const rows: PreviewRow[] = parsed.rows.map((row, i) => {
    const normalizedMerchant = normalizeMerchant(row.rawDescription);
    const fingerprint = computeFingerprint({
      financialAccountId,
      amount: row.amount,
      transactionDate: row.transactionDate,
      normalizedDescription: normalizedMerchant,
    });
    const isDuplicate = existingFingerprintSet.has(fingerprint);
    if (isDuplicate) duplicateCount++;

    const categorized = categorizeTransaction(
      { normalizedMerchant, rawDescription: row.rawDescription, amount: row.amount, direction: row.direction },
      merchantRules,
      categoryHistory,
    );

    return {
      key: `${i}-${fingerprint}`,
      transactionDate: row.transactionDate,
      postedDate: row.postedDate,
      rawDescription: row.rawDescription,
      normalizedMerchant,
      amount: row.amount,
      direction: row.direction,
      transactionType: categorized.transactionType,
      categoryName: categorized.categoryName,
      needsReview: categorized.needsReview,
      isTransferGuess: categorized.isTransferGuess,
      fingerprint,
      isDuplicate,
      excluded: isDuplicate,
    };
  });

  if (isAiClassifierEnabled()) {
    const { data: categoryRows } = await supabase
      .from("spending_categories")
      .select("name")
      .eq("budget_profile_id", budgetProfileId)
      .eq("archived", false);
    const availableCategories = (categoryRows ?? []).map((c) => c.name as string);

    let aiCallsUsed = 0;
    for (const row of rows) {
      if (!row.needsReview || row.isDuplicate || aiCallsUsed >= AI_FALLBACK_LIMIT) continue;
      aiCallsUsed++;
      const result = await classifyMerchant(row.rawDescription, availableCategories);
      if (result) {
        row.normalizedMerchant = result.merchant;
        row.categoryName = result.category;
        row.needsReview = false;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    filename: file.name,
    detectedProvider: parsed.detectedProvider,
    dateRange: parsed.dateRange,
    rows,
    duplicateCount,
    warnings: parsed.warnings,
  } satisfies ParsePreviewResponse);
}
