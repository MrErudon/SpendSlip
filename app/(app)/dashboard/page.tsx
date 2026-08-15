"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Plus, Receipt, Repeat, TrendingUp, Zap } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { useMonthSummary } from "@/lib/hooks/use-month-summary";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useBills } from "@/lib/hooks/use-bills";
import { useIncome } from "@/lib/hooks/use-income";
import { useInsights, useForecast } from "@/lib/hooks/use-insights";
import { useRecurringGroups } from "@/lib/hooks/use-recurring";
import { formatCurrency, formatDateLong } from "@/lib/utils";
import { currentMonthKey } from "@/components/month-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BillPanel } from "@/components/bill-modal";
import { InsightCard } from "@/components/insight-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export default function DashboardPage() {
  const { activeProfile, activeProfileId } = useProfile();
  const summary = useMonthSummary(activeProfileId);
  const { overdue, activity, reviewCount, loading } = useDashboard(activeProfileId);
  const { categories, addBill } = useBills(activeProfileId);
  const { form: incomeForm, update: updateIncome } = useIncome(activeProfileId);
  const { forecast } = useForecast(activeProfileId);
  const { categories: spendCategories, comparison, insights } = useInsights(activeProfileId, {
    month: currentMonthKey(),
    rangeMonths: 1,
  });
  const { groups: recurringGroups } = useRecurringGroups(activeProfileId);

  const [addBillOpen, setAddBillOpen] = React.useState(false);
  const [logOtOpen, setLogOtOpen] = React.useState(false);
  const [otHours, setOtHours] = React.useState("");

  function handleLogOt() {
    const hours = Number(otHours);
    if (hours > 0) {
      updateIncome("hours_worked_this_period", incomeForm.hours_worked_this_period + hours);
    }
    setLogOtOpen(false);
    setOtHours("");
  }

  const billsPct = summary.monthTotal > 0 ? (summary.paidTotal / summary.monthTotal) * 100 : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {activeProfile ? `${activeProfile.emoji} ${activeProfile.name}` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLogOtOpen(true)}>
            <Zap />
            Log OT
          </Button>
          <Button onClick={() => setAddBillOpen(true)}>
            <Plus />
            Add bill
          </Button>
        </div>
      </div>

      {!loading && overdue.length > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {overdue.length} overdue bill{overdue.length === 1 ? "" : "s"} totalling{" "}
            {formatCurrency(overdue.reduce((s, o) => s + o.amount, 0))}
          </span>
          <Link href="/bills" className="ml-auto font-medium underline underline-offset-2">
            Review
          </Link>
        </div>
      )}

      {reviewCount > 0 && (
        <div className="mx-6 mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm">
          <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {reviewCount} transaction{reviewCount === 1 ? "" : "s"} need{reviewCount === 1 ? "s" : ""} review
          </span>
          <Link href="/transactions" className="ml-auto font-medium text-primary underline underline-offset-2">
            Review
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 px-6 pt-4 lg:grid-cols-4">
        <Metric label="Monthly bills" value={formatCurrency(summary.monthTotal)} icon={Receipt} />
        <Metric label="Paid" value={formatCurrency(summary.paidTotal)} icon={CheckCircle2} tone="success" />
        <Metric label="Remaining" value={formatCurrency(summary.remainingTotal)} icon={Receipt} />
        <Metric label="Net income" value={formatCurrency(summary.netIncome)} icon={TrendingUp} tone="primary" />
      </div>

      {forecast && (
        <div className="px-6 pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Income" value={formatCurrency(forecast.expectedIncome)} icon={TrendingUp} />
            <Metric label="Spent" value={formatCurrency(forecast.spentSoFar)} icon={Receipt} />
            <Metric label="Bills remaining" value={formatCurrency(forecast.expectedRemainingBills)} icon={Receipt} />
            <Metric
              label="Projected surplus"
              value={formatCurrency(forecast.projectedSurplus)}
              icon={CheckCircle2}
              tone={forecast.projectedSurplus >= 0 ? "success" : "destructive"}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending vs. last month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {comparison.filter((c) => c.changePct !== null).length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough history yet.</p>
            ) : (
              comparison
                .filter((c) => c.changePct !== null)
                .slice(0, 5)
                .map((c) => (
                  <div key={c.categoryName} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.categoryName}</span>
                    <Badge variant={c.changePct! > 0 ? "warning" : "success"} className="tabular-nums">
                      {c.changePct! > 0 ? "+" : ""}
                      {Math.round(c.changePct! * 100)}%
                    </Badge>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top spending categories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {spendCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorized spending yet.</p>
            ) : (
              spendCategories.slice(0, 5).map((c) => (
                <div key={c.categoryName} className="flex items-center justify-between text-sm">
                  <span>{c.categoryName}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(c.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Repeat className="size-4" />
              Upcoming recurring charges
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recurringGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">None detected yet.</p>
            ) : (
              [...recurringGroups]
                .filter((g) => g.next_expected_date)
                .sort((a, b) => (a.next_expected_date! < b.next_expected_date! ? -1 : 1))
                .slice(0, 5)
                .map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <span>{g.normalized_merchant}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium tabular-nums text-foreground">{formatCurrency(g.estimated_amount)}</span>
                      {new Date(`${g.next_expected_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Potential savings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing stands out this month.</p>
            ) : (
              insights.slice(0, 3).map((insight, i) => <InsightCard key={i} insight={insight} />)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bills progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={billsPct} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(summary.paidTotal)} paid</span>
              <span>{billsPct.toFixed(0)}%</span>
              <span>{formatCurrency(summary.monthTotal)} total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OT status</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.otStatus?.covered ?? true ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-5" />
                <span className="text-sm font-medium">Covered — no OT needed this month</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-warning">
                <Zap className="size-5" />
                <span className="text-sm font-medium">
                  {summary.otStatus?.hoursNeeded.toFixed(1)}h of OT needed to cover bills
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pb-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid bills yet this period.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-success" />
                    <span>
                      Paid <span className="font-medium">{item.billName}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                    <span className="text-xs">{formatDateLong(item.paidAt)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <BillPanel
        open={addBillOpen}
        onOpenChange={setAddBillOpen}
        categories={categories}
        defaultCategoryId={categories[0]?.id ?? null}
        bill={null}
        onSave={async (input) => {
          await addBill(input);
        }}
        onDelete={async () => {}}
      />

      <Dialog open={logOtOpen} onOpenChange={setLogOtOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log overtime hours</DialogTitle>
            <DialogDescription>Adds to your hours worked this period on the Income page.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Hours</Label>
            <Input type="number" min={0} step="0.5" value={otHours} onChange={(e) => setOtHours(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOtOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogOt} disabled={!otHours || Number(otHours) <= 0}>
              Log hours
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "primary" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-md " +
            (tone === "success"
              ? "bg-success/15 text-success"
              : tone === "primary"
                ? "bg-primary/15 text-primary"
                : tone === "destructive"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary text-muted-foreground")
          }
        >
          <Icon className="size-4.5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs text-muted-foreground">{label}</span>
          <span className="truncate text-base font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
