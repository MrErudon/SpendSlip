"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { useProfile } from "@/lib/profile-context";
import { useIncome, INCOME_MODES, FILING_STATUSES } from "@/lib/hooks/use-income";
import { useMonthSummary } from "@/lib/hooks/use-month-summary";
import { bracketsFromRows, breakEvenHours, estimateTax, hourlyMonthlyGross, hoursNeededForGap, otRate } from "@/lib/tax";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function IncomeCalculator() {
  const { activeProfileId } = useProfile();
  const { form, update, loading, saveState, bracketsForFilingStatus } = useIncome(activeProfileId);
  const monthSummary = useMonthSummary(activeProfileId);

  const grossMonthly =
    form.mode === "hourly"
      ? hourlyMonthlyGross({ hourlyRate: form.hourly_rate ?? 0, hoursPerWeek: form.hours_per_week ?? 0 })
      : (form.annual_salary ?? 0) / 12;
  const grossAnnual = grossMonthly * 12 + form.additional_income * 12;

  const statusBrackets = bracketsForFilingStatus(form.filing_status);
  const est = estimateTax({
    grossAnnualIncome: grossAnnual,
    filingStatus: form.filing_status,
    stateRate: form.state_rate,
    flatRateOverride: form.flat_rate_override,
    brackets: statusBrackets.length > 0 ? bracketsFromRows(statusBrackets) : undefined,
  });
  const taxMonthly = est.totalTax / 12;
  const netMonthly = est.netAnnual / 12 + form.additional_income;

  const otGrossRate = form.mode === "hourly" ? otRate(form.hourly_rate ?? 0) : form.manual_ot_rate ?? 0;
  const otNetRate = otGrossRate * (1 - est.effectiveRate);

  const breakEven = breakEvenHours(monthSummary.monthTotal, form.hourly_rate ?? 0);
  const hoursToGoal = hoursNeededForGap(form.savings_goal, otNetRate);
  const stillNeeded = Math.max(0, hoursToGoal - form.hours_worked_this_period);

  if (loading) {
    return <div className="px-6 py-10 text-sm text-muted-foreground">Loading income settings…</div>;
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto px-6 py-5 scrollbar-thin lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Income</CardTitle>
            <Tabs value={form.mode} onValueChange={(v) => update("mode", v as typeof form.mode)}>
              <TabsList>
                {INCOME_MODES.map((m) => (
                  <TabsTrigger key={m.value} value={m.value}>
                    {m.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {form.mode === "hourly" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hourly rate">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.hourly_rate ?? 0}
                    onChange={(e) => update("hourly_rate", Number(e.target.value))}
                  />
                </Field>
                <Field label="Hours / week">
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={form.hours_per_week ?? 0}
                    onChange={(e) => update("hours_per_week", Number(e.target.value))}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Annual salary">
                  <Input
                    type="number"
                    min={0}
                    step="100"
                    value={form.annual_salary ?? 0}
                    onChange={(e) => update("annual_salary", Number(e.target.value))}
                  />
                </Field>
                <Field label="Manual OT rate ($/hr)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.manual_ot_rate ?? 0}
                    onChange={(e) => update("manual_ot_rate", Number(e.target.value))}
                  />
                </Field>
              </div>
            )}

            <Field label="Additional income (bonuses, OT lump sums / mo)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.additional_income}
                onChange={(e) => update("additional_income", Number(e.target.value))}
              />
            </Field>

            <Field label="Hours worked this period (OT logged)">
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.hours_worked_this_period}
                onChange={(e) => update("hours_worked_this_period", Number(e.target.value))}
              />
            </Field>

            <Field label="Savings goal (monthly $)">
              <Input
                type="number"
                min={0}
                step="1"
                value={form.savings_goal}
                onChange={(e) => update("savings_goal", Number(e.target.value))}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Filing status">
                <Select
                  value={form.filing_status}
                  onValueChange={(v) => update("filing_status", v as typeof form.filing_status)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="State tax rate (%)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.state_rate * 100}
                  onChange={(e) => update("state_rate", Number(e.target.value) / 100)}
                />
              </Field>
            </div>
            <Field label="Flat rate override (%) — replaces federal + FICA + state">
              <Input
                type="number"
                min={0}
                step="0.1"
                value={form.flat_rate_override !== null ? form.flat_rate_override * 100 : ""}
                placeholder="Off"
                onChange={(e) =>
                  update("flat_rate_override", e.target.value === "" ? null : Number(e.target.value) / 100)
                }
              />
            </Field>
          </CardContent>
        </Card>

        <div className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="size-3 text-success" /> Saved
            </>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-5 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ResultRow label="Gross monthly" value={formatCurrency(grossMonthly + form.additional_income)} />
            <ResultRow label="Tax estimate" value={formatCurrency(taxMonthly)} muted />
            <ResultRow label="Net take-home" value={formatCurrency(netMonthly)} highlight />
            <Separator />
            <ResultRow label="OT gross rate" value={`${formatCurrency(otGrossRate)}/hr`} />
            <ResultRow label="OT net rate" value={`${formatCurrency(otNetRate)}/hr`} />
            <Separator />
            <ResultRow label="Break-even hours/wk" value={`${breakEven.toFixed(1)}h`} />
            <ResultRow label="Hours to savings goal" value={`${hoursToGoal.toFixed(1)}h`} />
            <ResultRow label="Hours worked" value={`${form.hours_worked_this_period.toFixed(1)}h`} />
            <ResultRow
              label="Still needed"
              value={stillNeeded <= 0 ? "Covered" : `${stillNeeded.toFixed(1)}h`}
              highlight={stillNeeded <= 0}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ResultRow({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          highlight ? "font-semibold text-primary" : muted ? "text-muted-foreground" : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
