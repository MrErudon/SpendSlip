"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { useProfile } from "@/lib/profile-context";
import { useTransactions, DEFAULT_FILTERS, type TransactionRow } from "@/lib/hooks/use-transactions";
import { useSpendingCategories } from "@/lib/hooks/use-spending-categories";
import { useFinancialAccounts } from "@/lib/hooks/use-financial-accounts";
import { useMerchantRules } from "@/lib/hooks/use-merchant-rules";
import { TransactionFiltersBar } from "@/components/transaction-filters";
import { TransactionTable } from "@/components/transaction-table";
import { TransactionDetailPanel } from "@/components/transaction-detail-panel";
import { BulkActionBar } from "@/components/bulk-action-bar";

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={null}>
      <TransactionsPageInner />
    </React.Suspense>
  );
}

function TransactionsPageInner() {
  const { activeProfileId } = useProfile();
  const searchParams = useSearchParams();
  const importId = searchParams.get("import");

  const [filters, setFilters] = React.useState({ ...DEFAULT_FILTERS, statementImportId: importId });
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [openTransaction, setOpenTransaction] = React.useState<TransactionRow | null>(null);

  const { categories } = useSpendingCategories(activeProfileId);
  const { accounts } = useFinancialAccounts(activeProfileId);
  const { createRule } = useMerchantRules(activeProfileId);
  const { rows, totalCount, pageCount, loading, updateTransaction, bulkUpdate, bulkDelete, refresh } = useTransactions(
    activeProfileId,
    filters,
    page,
  );

  function patchFilters(patch: Partial<typeof filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (rows.every((r) => prev.has(r.id))) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }

  async function handleBulk(action: () => Promise<void>, message: string) {
    await action();
    toast.success(message);
    setSelected(new Set());
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">{totalCount} total across all imported statements.</p>
      </div>

      <TransactionFiltersBar
        filters={filters}
        onChange={patchFilters}
        categories={categories}
        accounts={accounts}
        monthOptions={lastNMonths(12)}
      />

      <BulkActionBar
        count={selected.size}
        categories={categories}
        onCategorize={(categoryId) =>
          handleBulk(() => bulkUpdate([...selected], { category_id: categoryId, needs_review: false }), "Categorized.")
        }
        onExclude={() => handleBulk(() => bulkUpdate([...selected], { is_excluded: true }), "Excluded from totals.")}
        onMarkTransfer={() => handleBulk(() => bulkUpdate([...selected], { is_transfer: true }), "Marked as transfer.")}
        onMarkRecurring={() => handleBulk(() => bulkUpdate([...selected], { is_recurring: true }), "Marked as recurring.")}
        onDelete={() => handleBulk(() => bulkDelete([...selected]), "Deleted.")}
        onClear={() => setSelected(new Set())}
      />

      <TransactionTable
        rows={rows}
        loading={loading}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onOpen={setOpenTransaction}
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      <TransactionDetailPanel
        transaction={openTransaction}
        categories={categories}
        onOpenChange={(open) => !open && setOpenTransaction(null)}
        onSave={async (id, patch) => {
          await updateTransaction(id, patch);
          await refresh();
        }}
        onCreateMerchantRule={createRule}
      />
    </div>
  );
}
