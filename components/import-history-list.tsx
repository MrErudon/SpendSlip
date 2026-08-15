"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";

import { useStatementImports } from "@/lib/hooks/use-statements";
import { useFinancialAccounts } from "@/lib/hooks/use-financial-accounts";
import { formatDateLong } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  review: "warning",
  failed: "destructive",
  processing: "secondary",
};

export const ImportHistoryList = React.forwardRef(function ImportHistoryList(
  { profileId }: { profileId: string | null },
  ref: React.Ref<{ refresh: () => void }>,
) {
  const { imports, loading, refresh, deleteImport } = useStatementImports(profileId);
  const { accounts } = useFinancialAccounts(profileId);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  React.useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Recent Imports</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : imports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No statements imported yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {imports.map((imp) => {
            const account = accounts.find((a) => a.id === imp.financial_account_id);
            return (
              <div key={imp.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{account?.account_name ?? imp.filename}</span>
                    <Badge variant={STATUS_VARIANT[imp.import_status] ?? "secondary"} className="text-[10px] capitalize">
                      {imp.import_status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {imp.transaction_count} transactions
                    {imp.statement_start_date && ` · ${formatDateLong(imp.statement_start_date)} – ${formatDateLong(imp.statement_end_date ?? imp.statement_start_date)}`}
                    {imp.imported_at && ` · Imported ${formatDateLong(imp.imported_at)}`}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/transactions?import=${imp.id}`}>View</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(imp.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this import record?</DialogTitle>
            <DialogDescription>
              The already-imported transactions stay in your ledger — only the import history entry (and the
              original file, if you kept it) is removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteImport(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
