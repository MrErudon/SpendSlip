import type { TransactionType } from "@/lib/types-financial";
import type { MerchantRule } from "@/lib/types-financial";

/**
 * Categorization order (docs/statement-import-expansion-plan.md §6/§8):
 *   1. user merchant rule       (merchantRules, DB-backed, checked here)
 *   2. normalized-merchant history (categoryHistory, pre-fetched by caller)
 *   3. built-in keyword/merchant map (this file)
 *   4. AI fallback              (lib/ai/financial-classifier.ts — applied
 *                                by the caller, not here, since it's async
 *                                and optional)
 *   5. "Needs Review"
 *
 * This module is pure and synchronous so it's trivially unit-testable;
 * the DB/AI lookups it depends on are pre-fetched and passed in.
 */

export interface CategorizeRowInput {
  normalizedMerchant: string;
  rawDescription: string;
  amount: number;
  direction: "inflow" | "outflow";
}

export interface CategorizeResult {
  categoryName: string | null;
  transactionType: TransactionType;
  isIncome: boolean;
  isTransferGuess: boolean;
  needsReview: boolean;
  source: "merchant_rule" | "history" | "builtin" | "keyword" | "none";
}

// normalized merchant (lowercased) -> category name, drawn from the
// standard category set seeded in spending_categories.
const BUILTIN_MERCHANT_CATEGORIES: Record<string, string> = {
  amazon: "Shopping",
  walmart: "Groceries",
  target: "Shopping",
  costco: "Groceries",
  "trader joe's": "Groceries",
  "whole foods": "Groceries",
  starbucks: "Dining",
  "uber eats": "Dining",
  doordash: "Dining",
  uber: "Transportation",
  lyft: "Transportation",
  netflix: "Subscriptions",
  spotify: "Subscriptions",
  hulu: "Subscriptions",
  "disney+": "Subscriptions",
  apple: "Subscriptions",
  google: "Subscriptions",
  shell: "Gas",
  chevron: "Gas",
  exxonmobil: "Gas",
  "the home depot": "Housing",
  "lowe's": "Housing",
  "cvs pharmacy": "Health",
  walgreens: "Health",
  "best buy": "Shopping",
  chipotle: "Dining",
  "mcdonald's": "Dining",
  "planet fitness": "Fitness",
  "at&t": "Utilities",
  verizon: "Utilities",
  "t-mobile": "Utilities",
  "comcast/xfinity": "Utilities",
  geico: "Insurance",
  progressive: "Insurance",
  "state farm": "Insurance",
};

// description keyword -> [category, transaction type]. Checked when no
// merchant-level match applies; order matters, first match wins.
const KEYWORD_RULES: [RegExp, string, TransactionType][] = [
  [/payroll|direct\s*dep|salary|paycheck/i, "Income", "income"],
  [/interest\s*(paid|earned)?/i, "Other", "interest"],
  [/overdraft|service\s*charge|maintenance\s*fee|nsf\s*fee/i, "Fees", "fee"],
  [/atm\s*(withdrawal)?|cash\s*withdrawal/i, "Cash", "cash_withdrawal"],
  [/refund|return\s*credit/i, "Shopping", "refund"],
  [/reimbursement/i, "Other", "reimbursement"],
  [/loan\s*payment|mortgage/i, "Debt", "loan_payment"],
];

const TRANSFER_KEYWORDS = /transfer\s*(to|from)|xfer|(credit\s*card\s*)?payment\s*(thank\s*you)?|autopay/i;

export function categorizeTransaction(
  input: CategorizeRowInput,
  merchantRules: MerchantRule[],
  categoryHistory: Map<string, string>, // normalized merchant (lowercase) -> category name
): CategorizeResult {
  const merchantKey = input.normalizedMerchant.toLowerCase();

  // 1. user merchant rule (highest priority first)
  const rule = [...merchantRules]
    .sort((a, b) => b.priority - a.priority)
    .find((r) => merchantKey.includes(r.merchant_pattern.toLowerCase()));
  if (rule) {
    return {
      categoryName: null, // caller resolves rule.category_id directly; name not needed
      transactionType: input.direction === "inflow" ? "income" : "purchase",
      isIncome: input.direction === "inflow",
      isTransferGuess: false,
      needsReview: false,
      source: "merchant_rule",
    };
  }

  // 2. prior history for this exact normalized merchant
  const historyCategory = categoryHistory.get(merchantKey);
  if (historyCategory) {
    return {
      categoryName: historyCategory,
      transactionType: input.direction === "inflow" ? "income" : "purchase",
      isIncome: input.direction === "inflow",
      isTransferGuess: false,
      needsReview: false,
      source: "history",
    };
  }

  // Transfer / credit-card-payment heuristic (single-sided guess; refined
  // by lib/statements/transfers.ts once both sides of an import are known).
  if (TRANSFER_KEYWORDS.test(input.rawDescription)) {
    return {
      categoryName: "Transfers",
      transactionType: "transfer",
      isIncome: false,
      isTransferGuess: true,
      needsReview: true,
      source: "keyword",
    };
  }

  // keyword rules (income, fees, cash, refunds, ...)
  for (const [pattern, category, type] of KEYWORD_RULES) {
    if (pattern.test(input.rawDescription)) {
      return {
        categoryName: category,
        transactionType: type,
        isIncome: type === "income",
        isTransferGuess: false,
        needsReview: false,
        source: "keyword",
      };
    }
  }

  // 3. built-in merchant map
  const builtin = BUILTIN_MERCHANT_CATEGORIES[merchantKey];
  if (builtin) {
    return {
      categoryName: builtin,
      transactionType: "purchase",
      isIncome: false,
      isTransferGuess: false,
      needsReview: false,
      source: "builtin",
    };
  }

  // 4. AI fallback is applied by the caller (async, optional). If it
  // declines too, this is the terminal "Needs Review" state.
  return {
    categoryName: input.direction === "inflow" ? "Income" : null,
    transactionType: input.direction === "inflow" ? "income" : "purchase",
    isIncome: input.direction === "inflow",
    isTransferGuess: false,
    needsReview: true,
    source: "none",
  };
}
