"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";

import { cn, formatDateLong } from "@/lib/utils";
import { useFinancialAccounts } from "@/lib/hooks/use-financial-accounts";
import { useSpendingCategories } from "@/lib/hooks/use-spending-categories";
import type { ImportResponse, ParsePreviewResponse, PreviewRow } from "@/lib/statements/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatementPreviewTable } from "@/components/statement-preview-table";
import { FinancialAccountManager } from "@/components/financial-account-manager";

export function StatementUploader({ profileId, onImported }: { profileId: string | null; onImported: () => void }) {
  const { accounts } = useFinancialAccounts(profileId);
  const { categories } = useSpendingCategories(profileId);

  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [preview, setPreview] = React.useState<ParsePreviewResponse | null>(null);
  const [rows, setRows] = React.useState<PreviewRow[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  async function handleFile(file: File) {
    if (!accountId) {
      toast.error("Choose an account first.");
      return;
    }
    setParsing(true);
    setPreview(null);
    setPendingFile(file);

    const form = new FormData();
    form.append("file", file);
    form.append("financial_account_id", accountId);

    try {
      const res = await fetch("/api/statements/parse", { method: "POST", body: form });
      const data: ParsePreviewResponse = await res.json();
      setPreview(data);
      setRows(data.rows ?? []);
      if (!data.ok) {
        toast.error(data.failureReason ?? "Couldn't parse this file.");
      } else if (data.duplicateCount > 0) {
        toast.warning(`This statement appears to have already been imported (${data.duplicateCount} duplicate transactions found).`);
      }
    } catch {
      setPreview({
        ok: false,
        failureReason: "Something went wrong while parsing the file.",
        filename: file.name,
        detectedProvider: null,
        dateRange: null,
        rows: [],
        duplicateCount: 0,
        warnings: [],
      });
    } finally {
      setParsing(false);
    }
  }

  function updateRow(key: string, patch: Partial<PreviewRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function reset() {
    setPreview(null);
    setRows([]);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    if (!preview || !accountId) return;
    const included = rows.filter((r) => !r.excluded);
    if (included.length === 0) {
      toast.error("Nothing selected to import.");
      return;
    }

    setImporting(true);
    const meta = {
      financial_account_id: accountId,
      filename: preview.filename,
      source_type: preview.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "csv",
      detected_provider: preview.detectedProvider,
      statement_start_date: preview.dateRange?.start ?? null,
      statement_end_date: preview.dateRange?.end ?? null,
      rows: included.map((r) => ({
        transactionDate: r.transactionDate,
        postedDate: r.postedDate,
        rawDescription: r.rawDescription,
        normalizedMerchant: r.normalizedMerchant,
        amount: r.amount,
        direction: r.direction,
        transactionType: r.transactionType,
        categoryName: r.categoryName,
        needsReview: r.needsReview,
        isTransferGuess: r.isTransferGuess,
      })),
    };

    const form = new FormData();
    form.append("meta", JSON.stringify(meta));
    if (pendingFile) form.append("file", pendingFile);

    try {
      const res = await fetch("/api/statements/import", { method: "POST", body: form });
      const data: ImportResponse = await res.json();
      if (data.ok) {
        toast.success(
          `Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}${
            data.skippedDuplicates > 0 ? ` (${data.skippedDuplicates} duplicates skipped)` : ""
          }.`,
        );
        reset();
        onImported();
      } else {
        toast.error(data.error ?? "Import failed.");
      }
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const includedCount = rows.filter((r) => !r.excluded).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  return (
    <div className="flex flex-col gap-4">
      <FinancialAccountManager profileId={profileId} compact />

      {accounts.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Importing into</span>
            <Select value={accountId ?? undefined} onValueChange={setAccountId}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
            )}
          >
            <UploadCloud className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Drag and drop a statement, or click to browse</p>
            <p className="text-xs text-muted-foreground">CSV (most reliable) or PDF bank/credit-card statements</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Parsing statement…
        </div>
      )}

      {preview && !preview.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{preview.failureReason}</span>
        </div>
      )}

      {preview && preview.ok && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span className="font-medium">{preview.filename}</span>
            {preview.detectedProvider && <span className="text-muted-foreground">{preview.detectedProvider}</span>}
            {preview.dateRange && (
              <span className="text-muted-foreground">
                {formatDateLong(preview.dateRange.start)} – {formatDateLong(preview.dateRange.end)}
              </span>
            )}
            <span className="text-muted-foreground">{rows.length} transactions found</span>
            {duplicateCount > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <AlertTriangle className="size-3.5" />
                {duplicateCount} possible duplicate{duplicateCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <StatementPreviewTable rows={rows} categories={categories} onChange={updateRow} />

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing || includedCount === 0}>
              {importing && <Loader2 className="size-3.5 animate-spin" />}
              Import {includedCount} transaction{includedCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
