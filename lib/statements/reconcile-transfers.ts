import type { SupabaseClient } from "@supabase/supabase-js";
import { findTransferMatches, type TransferCandidate } from "./transfers";

/**
 * Re-runs transfer/credit-card-payment matching across *all* of a budget
 * profile's transfer-looking transactions (not just a single import), so
 * a checking-account "TRANSFER TO SAVINGS" imported in March gets matched
 * once the savings statement with "TRANSFER FROM CHECKING" is imported in
 * April. Called server-side after every statement import.
 */
export async function reconcileTransfers(supabase: SupabaseClient, budgetProfileId: string): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id, financial_account_id, transaction_date, amount, needs_review, financial_accounts(account_type)")
    .eq("budget_profile_id", budgetProfileId)
    .eq("is_transfer", true)
    .eq("needs_review", true);

  const rows = (data ?? []) as unknown as {
    id: string;
    financial_account_id: string;
    transaction_date: string;
    amount: number;
    financial_accounts: { account_type: string } | null;
  }[];
  if (rows.length < 2) return 0;

  const candidates: TransferCandidate[] = rows.map((r) => ({
    id: r.id,
    financialAccountId: r.financial_account_id,
    accountType: (r.financial_accounts?.account_type ?? "other") as TransferCandidate["accountType"],
    transactionDate: r.transaction_date,
    amount: Number(r.amount),
  }));

  const matches = findTransferMatches(candidates);
  if (matches.length === 0) return 0;

  for (const match of matches) {
    const patch = {
      is_transfer: !match.isCreditCardPayment,
      is_credit_card_payment: match.isCreditCardPayment,
      needs_review: false,
    };
    await supabase.from("transactions").update(patch).eq("id", match.aId);
    await supabase.from("transactions").update(patch).eq("id", match.bId);
  }

  return matches.length * 2;
}
