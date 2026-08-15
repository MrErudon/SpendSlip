"use client";

import * as React from "react";
import { Check, Link2, Plus, X } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import { annualCost, monthlyEquivalent } from "@/lib/statements/recurring";
import type { RecurringGroup } from "@/lib/types-financial";
import type { Bill } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FREQUENCY_LABEL: Record<RecurringGroup["frequency"], string> = {
  weekly: "week",
  biweekly: "2 weeks",
  monthly: "mo",
  quarterly: "quarter",
  semiannual: "6 mo",
  annual: "year",
};

export function SubscriptionCard({
  group,
  bills,
  onConfirm,
  onIgnore,
  onAttach,
  onCreateBill,
}: {
  group: RecurringGroup;
  bills: Bill[];
  onConfirm: () => void;
  onIgnore: () => void;
  onAttach: (billId: string) => void;
  onCreateBill: () => void;
}) {
  const monthly = monthlyEquivalent(group.estimated_amount, group.frequency);
  const annual = annualCost(group.estimated_amount, group.frequency);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{group.normalized_merchant}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(group.estimated_amount)}/{FREQUENCY_LABEL[group.frequency]}
            </p>
          </div>
          <Badge variant={group.status === "confirmed" ? "success" : "secondary"} className="text-[10px] capitalize">
            {group.status}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Monthly</span>
          <span className="font-medium tabular-nums">{formatCurrency(monthly)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Annual cost</span>
          <span className="font-medium tabular-nums">{formatCurrency(annual)}</span>
        </div>
        {group.next_expected_date && (
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Next expected</span>
            <span>{new Date(`${group.next_expected_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5">
          {group.status !== "confirmed" && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onConfirm}>
              <Check className="size-3.5" />
              Confirm
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                <Link2 className="size-3.5" />
                {group.linked_bill_id ? "Linked" : "Attach to bill"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Attach to existing bill</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {bills.length === 0 && <DropdownMenuItem disabled>No bills yet</DropdownMenuItem>}
              {bills.map((b) => (
                <DropdownMenuItem key={b.id} onSelect={() => onAttach(b.id)}>
                  {b.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCreateBill}>
                <Plus className="size-3.5" />
                Create new bill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onIgnore}>
            <X className="size-3.5" />
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
