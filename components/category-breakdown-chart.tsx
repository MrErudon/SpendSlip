"use client";

import { formatCurrency } from "@/lib/utils";
import type { CategoryTotal } from "@/lib/statements/insights";

/** Simple CSS bar list — no charting dependency, matches the app's
 * restrained, information-dense visual language. */
export function CategoryBreakdownChart({ categories }: { categories: CategoryTotal[] }) {
  const max = Math.max(1, ...categories.map((c) => c.total));

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categorized spending in this period yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {categories.slice(0, 12).map((c) => (
        <div key={c.categoryName} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{c.categoryName}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(c.total / max) * 100}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums">{formatCurrency(c.total)}</span>
        </div>
      ))}
    </div>
  );
}
