"use client";

import * as React from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { toast } from "sonner";

import { useProfile } from "@/lib/profile-context";
import { useInsights, useForecast } from "@/lib/hooks/use-insights";
import { useSpendingCategories } from "@/lib/hooks/use-spending-categories";
import { formatCurrency } from "@/lib/utils";
import { MonthSelector, currentMonthKey, type MonthRange } from "@/components/month-selector";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { InsightCard } from "@/components/insight-card";
import { SuggestedBudgetCard } from "@/components/suggested-budget-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TAG_LABEL: Record<string, string> = {
  fixed: "Fixed",
  variable_essential: "Variable — essential",
  discretionary: "Discretionary",
  savings: "Savings",
  debt: "Debt",
  untagged: "Untagged",
};

export default function InsightsPage() {
  const { activeProfile, activeProfileId } = useProfile();
  const [range, setRange] = React.useState<MonthRange>({ month: currentMonthKey(), rangeMonths: 3 });
  const { loading, summary, categories, comparison, merchants, largest, tagBreakdown, insights, suggestedBudget, categoryBudgets } =
    useInsights(activeProfileId, range);
  const { forecast, loading: forecastLoading } = useForecast(activeProfileId);
  const { updateCategory, categories: spendingCategories } = useSpendingCategories(activeProfileId);
  const [showCalc, setShowCalc] = React.useState(false);

  const hasHistory = categories.length > 0;

  async function acceptBudget(amounts: Map<string, number>) {
    for (const [name, amount] of amounts) {
      const cat = spendingCategories.find((c) => c.name === name);
      if (cat) await updateCategory(cat.id, { budget_amount: amount });
    }
    toast.success("Budget updated.");
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"}
          </p>
        </div>
        <MonthSelector value={range} onChange={setRange} />
      </div>

      {!loading && !hasHistory ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
          <LineChart className="size-8" />
          <p className="text-sm font-medium">Not enough history yet</p>
          <p className="max-w-sm text-xs">
            Import at least one statement to start seeing insights. Three or more months produces better comparisons.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Monthly summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SummaryTile label="Income" value={formatCurrency(summary.income)} />
            <SummaryTile label="Spending" value={formatCurrency(summary.spending)} />
            <SummaryTile
              label="Surplus"
              value={formatCurrency(summary.surplus)}
              tone={summary.surplus >= 0 ? "success" : "destructive"}
            />
            <SummaryTile label="Recurring charges" value={formatCurrency(summary.recurringCharges)} />
            <SummaryTile label="Savings rate" value={`${(summary.savingsRate * 100).toFixed(1)}%`} />
          </div>

          {insights.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Worth reviewing</h2>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>{range.rangeMonths} month{range.rangeMonths === 1 ? "" : "s"} through {range.month}</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdownChart categories={categories} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Month-over-month</CardTitle>
                <CardDescription>Compared with the previous month</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {comparison.slice(0, 8).map((c) => (
                  <div key={c.categoryName} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.categoryName}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatCurrency(c.current)}</span>
                      {c.changePct !== null && (
                        <Badge variant={c.changePct > 0 ? "warning" : "success"} className="text-[10px] tabular-nums">
                          {c.changePct > 0 ? "+" : ""}
                          {Math.round(c.changePct * 100)}%
                        </Badge>
                      )}
                    </span>
                  </div>
                ))}
                {comparison.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top merchants</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {merchants.map((m) => (
                  <div key={m.merchant} className="flex items-center justify-between text-sm">
                    <span>{m.merchant}</span>
                    <span className="text-muted-foreground">
                      <span className="mr-2 tabular-nums font-medium text-foreground">{formatCurrency(m.total)}</span>
                      {m.count}x
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Largest transactions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {largest.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{t.normalizedMerchant}</span>
                    <span className="tabular-nums font-medium">{formatCurrency(Math.abs(t.amount))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fixed vs. discretionary</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {tagBreakdown.map((t) => (
                  <div key={t.tag} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{TAG_LABEL[t.tag] ?? t.tag}</span>
                    <span className="tabular-nums font-medium">{formatCurrency(t.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Month-end forecast</CardTitle>
                <CardDescription>Projection for the current month, in progress</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {forecastLoading || !forecast ? (
                  <p className="text-sm text-muted-foreground">Calculating…</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Projected month total</span>
                      <span className="font-medium tabular-nums">{formatCurrency(forecast.projectedMonthTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expected income</span>
                      <span className="font-medium tabular-nums">{formatCurrency(forecast.expectedIncome)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Projected surplus</span>
                      <span className={`tabular-nums ${forecast.projectedSurplus >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(forecast.projectedSurplus)}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowCalc((s) => !s)}
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`size-3 transition-transform ${showCalc ? "rotate-180" : ""}`} />
                      How this was calculated
                    </button>
                    {showCalc && (
                      <ul className="list-disc rounded-md bg-secondary/50 p-3 pl-6 text-xs text-muted-foreground">
                        {forecast.explanation.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <SuggestedBudgetCard budget={suggestedBudget} existingBudgets={categoryBudgets} onAccept={acceptBudget} />
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold tabular-nums ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
