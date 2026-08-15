"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TransactionFilters } from "@/lib/hooks/use-transactions";
import type { FinancialAccount, SpendingCategory } from "@/lib/types-financial";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TOGGLE_CHIPS: { key: keyof TransactionFilters; label: string }[] = [
  { key: "recurringOnly", label: "Recurring" },
  { key: "uncategorizedOnly", label: "Uncategorized" },
  { key: "reviewOnly", label: "Needs review" },
  { key: "excludedOnly", label: "Excluded" },
  { key: "incomeOnly", label: "Income" },
  { key: "transfersOnly", label: "Transfers" },
];

export function TransactionFiltersBar({
  filters,
  onChange,
  categories,
  accounts,
  monthOptions,
}: {
  filters: TransactionFilters;
  onChange: (patch: Partial<TransactionFilters>) => void;
  categories: SpendingCategory[];
  accounts: FinancialAccount[];
  monthOptions: string[];
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search merchant or description"
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>

        <Select value={filters.month} onValueChange={(v) => onChange({ month: v })}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.categoryId} onValueChange={(v) => onChange({ categoryId: v })}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.accountId} onValueChange={(v) => onChange({ accountId: v })}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TOGGLE_CHIPS.map((chip) => {
          const active = Boolean(filters[chip.key]);
          return (
            <button
              key={chip.key}
              onClick={() => onChange({ [chip.key]: !active } as Partial<TransactionFilters>)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
