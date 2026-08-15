"use client";

import { Inbox } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import type { BillWithOccurrence } from "@/lib/hooks/use-bills";
import { BillRow } from "@/components/bill-row";

interface BillListProps {
  bills: BillWithOccurrence[];
  loading: boolean;
  onOpen: (bill: BillWithOccurrence) => void;
  onTogglePaid: (occurrenceId: string, paid: boolean) => Promise<void>;
}

export function BillList({ bills, loading, onOpen, onTogglePaid }: BillListProps) {
  const total = bills.reduce((sum, b) => sum + (b.occurrence?.amount ?? b.amount), 0);
  const paid = bills.reduce((sum, b) => sum + (b.occurrence?.paid ? b.occurrence.amount : 0), 0);
  const remaining = total - paid;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
            Loading bills…
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm font-medium">No bills in this category yet</p>
            <p className="text-xs">Add a bill to start tracking due dates.</p>
          </div>
        ) : (
          bills.map((bill) => (
            <BillRow key={bill.id} bill={bill} onOpen={onOpen} onTogglePaid={onTogglePaid} />
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-6 border-t border-border bg-card px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Total <span className="ml-1.5 font-semibold text-foreground">{formatCurrency(total)}</span>
        </span>
        <span className="text-muted-foreground">
          Paid <span className="ml-1.5 font-semibold text-success">{formatCurrency(paid)}</span>
        </span>
        <span className="text-muted-foreground">
          Remaining <span className="ml-1.5 font-semibold text-foreground">{formatCurrency(remaining)}</span>
        </span>
      </div>
    </div>
  );
}
