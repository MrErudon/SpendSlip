"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { MerchantRule } from "@/lib/types-financial";

export function useMerchantRules(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rules, setRules] = React.useState<MerchantRule[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from("merchant_rules")
      .select("*")
      .eq("budget_profile_id", profileId)
      .order("priority", { ascending: false });
    setRules((data ?? []) as MerchantRule[]);
    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Creates (or bumps the priority of) a rule mapping `merchantPattern` to
   * `categoryId`, then applies it to every existing transaction for that
   * merchant so the correction takes effect immediately, not just on
   * future imports.
   */
  const createRule = React.useCallback(
    async (merchantPattern: string, categoryId: string, applyToExisting: boolean) => {
      if (!profileId) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("merchant_rules")
        .upsert(
          { user_id: user.id, budget_profile_id: profileId, merchant_pattern: merchantPattern, category_id: categoryId, priority: 1 },
          { onConflict: "budget_profile_id,merchant_pattern" },
        );

      if (applyToExisting) {
        await supabase
          .from("transactions")
          .update({ category_id: categoryId, needs_review: false })
          .eq("budget_profile_id", profileId)
          .ilike("normalized_merchant", `%${merchantPattern}%`);
      }

      await refresh();
    },
    [supabase, profileId, refresh],
  );

  const deleteRule = React.useCallback(
    async (id: string) => {
      await supabase.from("merchant_rules").delete().eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  return { rules, loading, refresh, createRule, deleteRule };
}
