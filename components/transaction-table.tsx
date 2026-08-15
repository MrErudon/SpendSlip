"use client";

import { AlertTriangle, ArrowLeftRight, Ban, ChevronLeft, ChevronRight, Repeat } from "lucide-react";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { TransactionRow } from "@/lib/hooks/use-transactions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TransactionTableProps {
  rows: TransactionRow[];
  loading: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (row: TransactionRow) => void;
  page: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function TransactionTable({
  rows,
  loading,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  page,
  pageCount,
  totalCount,
  onPageChange,
}: TransactionTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="w-8 px-4 py-2">
                <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
              </th>
              <th className="px-2 py-2 text-left font-medium">Date</th>
              <th className="px-2 py-2 text-left font-medium">Merchant</th>
              <th className="px-2 py-2 text-left font-medium">Account</th>
              <th className="px-2 py-2 text-left font-medium">Category</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 text-left font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading transactions…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors hover:bg-secondary/50",
                    row.is_excluded && "opacity-50",
                  )}
                  onClick={() => onOpen(row)}
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => onToggleSelect(row.id)} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{formatDate(row.transaction_date)}</td>
                  <td className="px-2 py-2 font-medium">{row.normalized_merchant}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.account_name ?? "—"}</td>
                  <td className="px-2 py-2">
                    {row.category_name ? (
                      <span>
                        {row.category_emoji} {row.category_name}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Uncategorized
                      </Badge>
                    )}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-2 text-right tabular-nums font-medium",
                      row.direction === "inflow" ? "text-success" : "text-foreground",
                    )}
                  >
                    {row.direction === "inflow" ? "+" : ""}
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {row.is_recurring && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Repeat className="size-2.5" />
                        </Badge>
                      )}
                      {(row.is_transfer || row.is_credit_card_payment) && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <ArrowLeftRight className="size-2.5" />
                        </Badge>
                      )}
                      {row.is_excluded && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Ban className="size-2.5" />
                        </Badge>
                      )}
                      {row.needs_review && (
                        <Badge variant="warning" className="gap-1 text-[10px]">
                          <AlertTriangle className="size-2.5" />
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-2 text-xs text-muted-foreground">
        <span>{totalCount} transactions</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-7" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
