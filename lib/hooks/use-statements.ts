"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { StatementImport } from "@/lib/types-financial";

export function useStatementImports(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [imports, setImports] = React.useState<StatementImport[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from("statement_imports")
      .select("*")
      .eq("budget_profile_id", profileId)
      .order("created_at", { ascending: false });
    setImports((data ?? []) as StatementImport[]);
    setLoading(false);
  }, [supabase, profileId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteImport = React.useCallback(
    async (id: string) => {
      // Transactions reference statement_import_id with ON DELETE SET NULL,
      // so deleting an import removes the record but keeps the
      // already-imported transactions (they just lose their import
      // provenance). This matches "delete import" in the spec, which is
      // distinct from bulk-deleting the transactions themselves.
      await supabase.from("statement_imports").delete().eq("id", id);
      await refresh();
    },
    [supabase, refresh],
  );

  return { imports, loading, refresh, deleteImport };
}
