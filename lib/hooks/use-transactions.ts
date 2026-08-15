"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionType } from "@/lib/types-financial";

export interface TransactionRow extends Transaction {
  category_name: string | null;
  category_emoji: string | null;
  account_name: string | null;
}

export interface TransactionFilters {
  search: string;
  categoryId: string | "all";
  accountId: string | "all";
  month: string | "all"; // "YYYY-MM"
  transactionType: TransactionType | "all";
  recurringOnly: boolean;
  uncategorizedOnly: boolean;
  excludedOnly: boolean;
  incomeOnly: boolean;
  transfersOnly: boolean;
  reviewOnly: boolean;
  statementImportId: string | null;
}

export const DEFAULT_FILTERS: TransactionFilters = {
  search: "",
  categoryId: "all",
  accountId: "all",
  month: "all",
  transactionType: "all",
  recurringOnly: false,
  uncategorizedOnly: false,
  excludedOnly: false,
  incomeOnly: false,
  transfersOnly: false,
  reviewOnly: false,
  statementImportId: null,
};

const PAGE_SIZE = 50;

export function useTransactions(profileId: string | null, filters: TransactionFilters, page: number) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<TransactionRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    let query = supabase
      .from("transactions")
      .select("*, spending_categories(name, emoji), financial_accounts(account_name)", { count: "exact" })
      .eq("budget_profile_id", profileId);

    if (filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`normalized_merchant.ilike.${term},raw_description.ilike.${term}`);
    }
    if (filters.categoryId !== "all") query = query.eq("category_id", filters.categoryId);
    if (filters.accountId !== "all") query = query.eq("financial_account_id", filters.accountId);
    if (filters.transactionType !== "all") query = query.eq("transaction_type", filters.transactionType);
    if (filters.statementImportId) query = query.eq("statement_import_id", filters.statementImportId);
    if (filters.month !== "all") {
      const [y, m] = filters.month.split("-").map(Number);
      const start = `${filters.month}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      query = query.gte("transaction_date", start).lte("transaction_date", end);
    }
    if (filters.recurringOnly) query = query.eq("is_recurring", true);
    if (filters.uncategorizedOnly) query = query.is("category_id", null);
    if (filters.excludedOnly) query = query.eq("is_excluded", true);
    if (filters.incomeOnly) query = query.eq("is_income", true);
    if (filters.transfersOnly) query = query.or("is_transfer.eq.true,is_credit_card_payment.eq.true");
    if (filters.reviewOnly) query = query.eq("needs_review", true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await query.order("transaction_date", { ascending: false }).range(from, to);

    setRows(
      ((data ?? []) as unknown as (Transaction & {
        spending_categories: { name: string; emoji: string } | null;
        financial_accounts: { account_name: string } | null;
      })[]).map((r) => ({
        ...r,
        category_name: r.spending_categories?.name ?? null,
        category_emoji: r.spending_categories?.emoji ?? null,
        account_name: r.financial_accounts?.account_name ?? null,
      })),
    );
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [supabase, profileId, filters, page]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const updateTransaction = React.useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      await supabase.from("transactions").update(patch).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const bulkUpdate = React.useCallback(
    async (ids: string[], patch: Partial<Transaction>) => {
      await supabase.from("transactions").update(patch).in("id", ids);
      await refresh();
    },
    [supabase, refresh],
  );

  const bulkDelete = React.useCallback(
    async (ids: string[]) => {
      await supabase.from("transactions").delete().in("id", ids);
      await refresh();
    },
    [supabase, refresh],
  );

  return {
    rows,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
    loading,
    refresh,
    updateTransaction,
    bulkUpdate,
    bulkDelete,
  };
}
