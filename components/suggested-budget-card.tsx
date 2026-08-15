"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import type { SuggestedBudget } from "@/lib/statements/budget-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SuggestedBudgetCard({
  budget,
  existingBudgets,
  onAccept,
}: {
  budget: SuggestedBudget;
  existingBudgets: Map<string, number>;
  onAccept: (amounts: Map<string, number>) => Promise<void>;
}) {
  const [customizing, setCustomizing] = React.useState(false);
  const [amounts, setAmounts] = React.useState<Map<string, number>>(new Map());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setAmounts(new Map(budget.lines.map((l) => [l.categoryName, l.suggestedAmount])));
  }, [budget]);

  async function handleAccept() {
    setSaving(true);
    await onAccept(amounts);
    setSaving(false);
    setCustomizing(false);
  }

  if (budget.lines.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" />
            Suggested Monthly Budget
          </CardTitle>
          <CardDescription>
            Based on {budget.monthsOfData} month{budget.monthsOfData === 1 ? "" : "s"} of spending history.{" "}
            {budget.confidence === "low" && "Budget confidence improves with 3+ months of statements."}
          </CardDescription>
        </div>
        <Badge variant={budget.confidence === "high" ? "success" : budget.confidence === "medium" ? "warning" : "secondary"} className="capitalize">
          {budget.confidence} confidence
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          {budget.lines.map((line) => {
            const alreadySet = existingBudgets.has(line.categoryName);
            return (
              <div key={line.categoryName} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {line.categoryName}
                  {alreadySet && (
                    <Badge variant="outline" className="ml-1.5 text-[10px]">
                      Has budget
                    </Badge>
                  )}
                </span>
                {customizing ? (
                  <Input
                    type="number"
                    min={0}
                    value={amounts.get(line.categoryName) ?? line.suggestedAmount}
                    onChange={(e) =>
                      setAmounts((prev) => new Map(prev).set(line.categoryName, Number(e.target.value)))
                    }
                    className="h-7 w-28 text-right text-xs tabular-nums"
                  />
                ) : (
                  <span className="font-medium tabular-nums">{formatCurrency(line.suggestedAmount)}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
          <span>Savings</span>
          <span className="tabular-nums text-success">{formatCurrency(budget.suggestedSavings)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Buffer</span>
          <span className="tabular-nums">{formatCurrency(budget.suggestedBuffer)}</span>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          {customizing ? (
            <Button size="sm" variant="outline" onClick={() => setCustomizing(false)}>
              Cancel
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCustomizing(true)}>
              Customize
            </Button>
          )}
          <Button size="sm" onClick={handleAccept} disabled={saving}>
            {customizing ? "Apply Custom Budget" : "Accept Suggested Budget"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
