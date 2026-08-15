"use client";

import * as React from "react";
import { ExternalLink, Repeat } from "lucide-react";

import { daysUntil, formatCurrency, formatDate } from "@/lib/utils";
import type { BillWithOccurrence } from "@/lib/hooks/use-bills";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const RECURRENCE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  biweekly: "Bi-weekly",
  weekly: "Weekly",
  annual: "Annual",
};

function dueBadge(bill: BillWithOccurrence): { label: string; variant: "success" | "destructive" | "warning" | "secondary" } {
  const occ = bill.occurrence;
  if (!occ) return { label: "Not scheduled", variant: "secondary" };
  if (occ.paid) return { label: "Paid", variant: "success" };
  const days = daysUntil(occ.due_date);
  if (days < 0) return { label: "Overdue", variant: "destructive" };
  if (days === 0) return { label: "Today", variant: "warning" };
  if (days <= 6) return { label: `In ${days}d`, variant: "warning" };
  return { label: formatDate(occ.due_date), variant: "secondary" };
}

interface BillRowProps {
  bill: BillWithOccurrence;
  onOpen: (bill: BillWithOccurrence) => void;
  onTogglePaid: (occurrenceId: string, paid: boolean) => Promise<void>;
}

export function BillRow({ bill, onOpen, onTogglePaid }: BillRowProps) {
  const [confirmPay, setConfirmPay] = React.useState(false);
  const badge = dueBadge(bill);
  const occ = bill.occurrence;

  function handlePayClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (bill.payment_url) {
      window.open(bill.payment_url, "_blank", "noopener,noreferrer");
    }
    setConfirmPay(true);
  }

  async function confirmMarkPaid() {
    if (occ) await onTogglePaid(occ.id, true);
    setConfirmPay(false);
  }

  return (
    <>
      <div
        onClick={() => onOpen(bill)}
        className="group flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-sm transition-colors hover:bg-secondary/50"
      >
        <Checkbox
          checked={occ?.paid ?? false}
          disabled={!occ}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(checked) => occ && onTogglePaid(occ.id, checked === true)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{bill.name}</span>
            {bill.autopay && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Repeat className="size-2.5" /> Autopay
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{RECURRENCE_LABEL[bill.recurrence]}</span>
        </div>
        <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatCurrency(bill.amount)}</span>
        <Badge variant={badge.variant} className="w-24 shrink-0 justify-center">
          {badge.label}
        </Badge>
        <div className="w-20 shrink-0 text-right">
          {bill.payment_url && occ && !occ.paid && (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={handlePayClick}>
              Pay <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmPay} onOpenChange={setConfirmPay}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark {bill.name} as paid?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We opened the payment page in a new tab. Once you&apos;ve paid, confirm below.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPay(false)}>
              Not yet
            </Button>
            <Button onClick={confirmMarkPaid}>Mark as paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
