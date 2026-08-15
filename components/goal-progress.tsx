"use client";

import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface GoalProgressProps {
  label: string;
  contributed: number;
  goal: number;
  deadline?: string | null;
}

export function GoalProgress({ label, contributed, goal, deadline }: GoalProgressProps) {
  const pct = goal > 0 ? Math.min(100, (contributed / goal) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {formatCurrency(contributed)} <span className="text-xs">/ {formatCurrency(goal)}</span>
        </span>
      </div>
      <Progress value={pct} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% funded</span>
        {deadline && <span>Due {new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
      </div>
    </div>
  );
}
