"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { SpendingCategory, SpendingTag } from "@/lib/types-financial";

export interface SpendingCategoryInput {
  name: string;
  emoji: string;
  spending_tag: SpendingTag | null;
  budget_amount: number | null;
}

export function useSpendingCategories(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [categories, setCategories] = React.useState<SpendingCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from("spending_categories")
      .select("*")
      .eq("budget_profile_id", profileId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });
    setCategories((data ?? []) as SpendingCategory[]);
    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const addCategory = React.useCallback(
    async (input: SpendingCategoryInput) => {
      if (!profileId) return;
      await supabase
        .from("spending_categories")
        .insert({ ...input, budget_profile_id: profileId, sort_order: categories.length });
      await refresh();
    },
    [supabase, profileId, categories.length, refresh],
  );

  const updateCategory = React.useCallback(
    async (id: string, input: Partial<SpendingCategoryInput>) => {
      await supabase.from("spending_categories").update(input).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  const archiveCategory = React.useCallback(
    async (id: string) => {
      await supabase.from("spending_categories").update({ archived: true }).eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  return { categories, loading, refresh, addCategory, updateCategory, archiveCategory };
}
