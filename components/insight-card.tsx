"use client";

import { AlertTriangle, Copy, TrendingUp } from "lucide-react";

import type { Insight } from "@/lib/statements/insights";

const ICONS: Record<Insight["type"], typeof AlertTriangle> = {
  category_above_average: TrendingUp,
  large_transaction: AlertTriangle,
  possible_duplicate: Copy,
  new_recurring: TrendingUp,
};

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = ICONS[insight.type];
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <p className="font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.message}</p>
      </div>
    </div>
  );
}
