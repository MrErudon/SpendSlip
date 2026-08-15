"use client";

import { AlertTriangle } from "lucide-react";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { PaycheckWithAllocations } from "@/lib/hooks/use-planner";

interface PaycheckCardProps {
  paycheck: PaycheckWithAllocations;
  selected: boolean;
  unassignedCount: number;
  onSelect: () => void;
}

export function PaycheckCard({ paycheck, selected, unassignedCount, onSelect }: PaycheckCardProps) {
  const allocated = paycheck.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const remaining = Number(paycheck.amount) - allocated;
  const overBudget = remaining < 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-52 shrink-0 flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/50",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{formatDate(paycheck.date)}</span>
        {!paycheck.is_manual ? null : (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">Manual</span>
        )}
      </div>
      <span className="text-lg font-semibold tabular-nums">{formatCurrency(paycheck.amount)}</span>
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium tabular-nums", overBudget ? "text-destructive" : "text-success")}>
          {overBudget && <AlertTriangle className="mr-1 inline size-3" />}
          {formatCurrency(remaining)} left
        </span>
        {unassignedCount > 0 && (
          <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            {unassignedCount} unassigned
          </span>
        )}
      </div>
    </button>
  );
}
