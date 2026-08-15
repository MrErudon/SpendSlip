"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface MonthRange {
  /** The last (most recent) month included, "YYYY-MM". */
  month: string;
  /** How many trailing months, ending at `month`, are in view. */
  rangeMonths: 1 | 3 | 6 | 12;
}

const PRESETS: { label: string; rangeMonths: MonthRange["rangeMonths"]; anchorOffset: number }[] = [
  { label: "Current Month", rangeMonths: 1, anchorOffset: 0 },
  { label: "Last Month", rangeMonths: 1, anchorOffset: -1 },
  { label: "3 Months", rangeMonths: 3, anchorOffset: 0 },
  { label: "6 Months", rangeMonths: 6, anchorOffset: 0 },
  { label: "12 Months", rangeMonths: 12, anchorOffset: 0 },
];

export function currentMonthKey(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Reusable month/range picker: "<- July 2026 ->" plus quick presets. Used
 * on Dashboard, Transactions, Insights, and Subscriptions. */
export function MonthSelector({ value, onChange }: { value: MonthRange; onChange: (next: MonthRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onChange({ ...value, month: shiftMonth(value.month, -1) })}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="w-36 text-center text-sm font-medium">{monthLabel(value.month)}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onChange({ ...value, month: shiftMonth(value.month, 1) })}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const active = value.rangeMonths === preset.rangeMonths;
          return (
            <button
              key={preset.label}
              onClick={() => onChange({ month: currentMonthKey(preset.anchorOffset), rangeMonths: preset.rangeMonths })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
