import type { SupabaseClient } from "@supabase/supabase-js";
import { detectRecurringGroups, type RecurringTransactionInput } from "./recurring";

/**
 * Runs recurring-charge detection across a budget profile's transaction
 * history and persists the results to `recurring_groups`, then flips
 * `is_recurring` + `recurring_group_id` on the matched transactions.
 * Called after every statement import (see the import route) and
 * available for a manual "Re-scan" action on the Subscriptions page.
 *
 * Never downgrades a group the user already confirmed or ignored back to
 * "detected" — re-running detection only refines the amount/cadence
 * estimate for groups still in the default state.
 */
export async function detectAndPersistRecurring(
  supabase: SupabaseClient,
  userId: string,
  budgetProfileId: string,
): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id, normalized_merchant, amount, transaction_date")
    .eq("budget_profile_id", budgetProfileId)
    .eq("is_excluded", false)
    .eq("is_transfer", false)
    .eq("is_credit_card_payment", false)
    .order("transaction_date", { ascending: true });

  const rows = (data ?? []) as { id: string; normalized_merchant: string; amount: number; transaction_date: string }[];
  const inputs: RecurringTransactionInput[] = rows.map((r) => ({
    id: r.id,
    normalizedMerchant: r.normalized_merchant,
    amount: Number(r.amount),
    transactionDate: r.transaction_date,
  }));

  const candidates = detectRecurringGroups(inputs);
  if (candidates.length === 0) return 0;

  const { data: existingGroups } = await supabase
    .from("recurring_groups")
    .select("id, normalized_merchant, status")
    .eq("budget_profile_id", budgetProfileId);
  const existingByMerchant = new Map(
    ((existingGroups ?? []) as { id: string; normalized_merchant: string; status: string }[]).map((g) => [
      g.normalized_merchant.toLowerCase(),
      g,
    ]),
  );

  for (const candidate of candidates) {
    const key = candidate.normalizedMerchant.toLowerCase();
    const existing = existingByMerchant.get(key);

    let groupId: string;
    if (existing) {
      await supabase
        .from("recurring_groups")
        .update({
          estimated_amount: candidate.estimatedAmount,
          frequency: candidate.frequency,
          next_expected_date: candidate.nextExpectedDate,
          confidence_score: candidate.confidenceScore,
        })
        .eq("id", existing.id);
      groupId = existing.id;
    } else {
      const { data: inserted } = await supabase
        .from("recurring_groups")
        .insert({
          user_id: userId,
          budget_profile_id: budgetProfileId,
          normalized_merchant: candidate.normalizedMerchant,
          estimated_amount: candidate.estimatedAmount,
          frequency: candidate.frequency,
          next_expected_date: candidate.nextExpectedDate,
          confidence_score: candidate.confidenceScore,
          status: "detected",
        })
        .select("id")
        .single();
      if (!inserted) continue;
      groupId = inserted.id;
    }

    await supabase
      .from("transactions")
      .update({ is_recurring: true, recurring_group_id: groupId })
      .in("id", candidate.transactionIds);
  }

  return candidates.length;
}
