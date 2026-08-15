// Domain types for the statement-import / transaction-ledger expansion.
// Mirrors supabase/migrations/20260101000006_financial_tables.sql onward.
// Kept separate from lib/types.ts (bills/income/planner/shared) to keep
// each file focused; both feed the same Supabase clients in
// lib/supabase/{client,server}.ts.

export type AccountType = "checking" | "savings" | "credit_card" | "loan" | "cash" | "other";

export type StatementSourceType = "csv" | "pdf";

export type ImportStatus = "processing" | "review" | "completed" | "failed";

export type TransactionDirection = "inflow" | "outflow";

export type TransactionType =
  | "purchase"
  | "income"
  | "transfer"
  | "credit_card_payment"
  | "loan_payment"
  | "refund"
  | "reimbursement"
  | "cash_withdrawal"
  | "fee"
  | "interest"
  | "other";

export type SpendingTag = "fixed" | "variable_essential" | "discretionary" | "savings" | "debt";

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";

export type RecurringStatus = "detected" | "confirmed" | "ignored";

export interface FinancialAccount {
  id: string;
  user_id: string;
  budget_profile_id: string;
  institution_name: string | null;
  account_name: string;
  account_type: AccountType;
  last_four: string | null;
  currency: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpendingCategory {
  id: string;
  budget_profile_id: string;
  name: string;
  emoji: string;
  spending_tag: SpendingTag | null;
  budget_amount: number | null;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StatementImport {
  id: string;
  user_id: string;
  budget_profile_id: string;
  financial_account_id: string;
  filename: string;
  source_type: StatementSourceType;
  detected_provider: string | null;
  statement_start_date: string | null;
  statement_end_date: string | null;
  transaction_count: number;
  import_status: ImportStatus;
  original_file_path: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  budget_profile_id: string;
  financial_account_id: string;
  statement_import_id: string | null;
  transaction_date: string;
  posted_date: string | null;
  raw_description: string;
  normalized_merchant: string;
  amount: number;
  direction: TransactionDirection;
  transaction_type: TransactionType;
  category_id: string | null;
  is_recurring: boolean;
  recurring_group_id: string | null;
  is_transfer: boolean;
  is_credit_card_payment: boolean;
  is_refund: boolean;
  is_reimbursement: boolean;
  is_income: boolean;
  is_excluded: boolean;
  needs_review: boolean;
  fingerprint: string;
  user_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantRule {
  id: string;
  user_id: string;
  budget_profile_id: string;
  merchant_pattern: string;
  normalized_merchant: string | null;
  category_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringGroup {
  id: string;
  user_id: string;
  budget_profile_id: string;
  normalized_merchant: string;
  estimated_amount: number;
  frequency: RecurringFrequency;
  next_expected_date: string | null;
  confidence_score: number;
  category_id: string | null;
  status: RecurringStatus;
  linked_bill_id: string | null;
  created_at: string;
  updated_at: string;
}

/** True spending-affecting flags — a transaction counts toward totals
 * only when none of these exclusion reasons apply. */
export function isSpendCounted(t: Pick<Transaction, "is_transfer" | "is_credit_card_payment" | "is_excluded">) {
  return !t.is_transfer && !t.is_credit_card_payment && !t.is_excluded;
}
