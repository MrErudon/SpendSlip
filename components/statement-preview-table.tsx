"use client";

import { AlertTriangle } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import type { PreviewRow } from "@/lib/statements/types";
import type { SpendingCategory } from "@/lib/types-financial";
import type { TransactionType } from "@/lib/types-financial";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRANSACTION_TYPES: TransactionType[] = [
  "purchase",
  "income",
  "transfer",
  "credit_card_payment",
  "loan_payment",
  "refund",
  "reimbursement",
  "cash_withdrawal",
  "fee",
  "interest",
  "other",
];

interface StatementPreviewTableProps {
  rows: PreviewRow[];
  categories: SpendingCategory[];
  onChange: (key: string, patch: Partial<PreviewRow>) => void;
}

export function StatementPreviewTable({ rows, categories, onChange }: StatementPreviewTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border scrollbar-thin">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-secondary/60 text-xs text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="px-2 py-2 text-left font-medium">Date</th>
            <th className="px-2 py-2 text-left font-medium">Merchant</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-left font-medium">Type</th>
            <th className="px-2 py-2 text-left font-medium">Category</th>
            <th className="px-2 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`border-t border-border ${row.excluded ? "opacity-50" : ""} ${row.isDuplicate ? "bg-warning/5" : ""}`}
            >
              <td className="px-2 py-1.5">
                <Checkbox checked={!row.excluded} onCheckedChange={(c) => onChange(row.key, { excluded: c !== true })} />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="date"
                  value={row.transactionDate}
                  onChange={(e) => onChange(row.key, { transactionDate: e.target.value })}
                  className="h-7 w-[130px] text-xs"
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  value={row.normalizedMerchant}
                  onChange={(e) => onChange(row.key, { normalizedMerchant: e.target.value })}
                  className="h-7 min-w-[160px] text-xs"
                  title={row.rawDescription}
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => {
                    const amount = Number(e.target.value);
                    onChange(row.key, { amount, direction: amount < 0 ? "outflow" : "inflow" });
                  }}
                  className="h-7 w-[100px] text-right text-xs tabular-nums"
                />
              </td>
              <td className="px-2 py-1.5">
                <Select value={row.transactionType} onValueChange={(v) => onChange(row.key, { transactionType: v as TransactionType })}>
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-2 py-1.5">
                <Select
                  value={row.categoryName ?? "__none"}
                  onValueChange={(v) => onChange(row.key, { categoryName: v === "__none" ? null : v })}
                >
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue placeholder="Needs review" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" className="text-xs">
                      Needs review
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name} className="text-xs">
                        {c.emoji} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-2 py-1.5">
                {row.isDuplicate ? (
                  <Badge variant="warning" className="gap-1 text-[10px]">
                    <AlertTriangle className="size-2.5" />
                    Duplicate
                  </Badge>
                ) : row.needsReview ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Review
                  </Badge>
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(row.amount)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
