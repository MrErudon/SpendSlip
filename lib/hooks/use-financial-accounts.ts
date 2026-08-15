"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccountType, FinancialAccount } from "@/lib/types-financial";

export interface FinancialAccountInput {
  institution_name: string | null;
  account_name: string;
  account_type: AccountType;
  last_four: string | null;
}

export function useFinancialAccounts(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [accounts, setAccounts] = React.useState<FinancialAccount[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from("financial_accounts")
      .select("*")
      .eq("budget_profile_id", profileId)
      .eq("archived", false)
      .order("created_at", { ascending: true });
    setAccounts((data ?? []) as FinancialAccount[]);
    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const addAccount = React.useCallback(
    async (input: FinancialAccountInput) => {
      if (!profileId) return null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("financial_accounts")
        .insert({ ...input, budget_profile_id: profileId, user_id: user.id })
        .select()
        .single();
      if (error) return null;
      await refresh();
      return data as FinancialAccount;
    },
    [supabase, profileId, refresh],
  );

  const updateAccount = React.useCallback(
    async (id: string, input: Partial<FinancialAccountInput>) => {
      await supabase.from("financial_accounts").update(input).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const archiveAccount = React.useCallback(
    async (id: string) => {
      await supabase.from("financial_accounts").update({ archived: true }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const deleteAccount = React.useCallback(
    async (id: string) => {
      await supabase.from("financial_accounts").delete().eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  return { accounts, loading, refresh, addAccount, updateAccount, archiveAccount, deleteAccount };
}

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
  { value: "loan", label: "Loan" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];
