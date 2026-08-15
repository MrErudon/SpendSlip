"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { FilingStatus, IncomeMode, IncomeSettings, TaxBracket } from "@/lib/types";

export type IncomeForm = Omit<IncomeSettings, "id" | "profile_id" | "created_at" | "updated_at">;

const DEFAULT_FORM: IncomeForm = {
  mode: "hourly",
  hourly_rate: 0,
  hours_per_week: 40,
  annual_salary: 0,
  manual_ot_rate: null,
  additional_income: 0,
  filing_status: "single",
  state_rate: 0,
  flat_rate_override: null,
  savings_goal: 0,
  hours_worked_this_period: 0,
};

const SAVE_DEBOUNCE_MS = 1000;

export function useIncome(profileId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [form, setForm] = React.useState<IncomeForm>(DEFAULT_FORM);
  const [brackets, setBrackets] = React.useState<TaxBracket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [{ data: income }, { data: taxRows }] = await Promise.all([
        supabase.from("income_settings").select("*").eq("profile_id", profileId).maybeSingle(),
        supabase.from("tax_brackets").select("*").eq("year", 2026),
      ]);
      if (cancelled) return;

      if (income) {
        const row = income as IncomeSettings;
        rowId.current = row.id;
        setForm({
          mode: row.mode,
          hourly_rate: row.hourly_rate,
          hours_per_week: row.hours_per_week,
          annual_salary: row.annual_salary,
          manual_ot_rate: row.manual_ot_rate,
          additional_income: row.additional_income,
          filing_status: row.filing_status,
          state_rate: row.state_rate,
          flat_rate_override: row.flat_rate_override,
          savings_goal: row.savings_goal,
          hours_worked_this_period: row.hours_worked_this_period,
        });
      }
      setBrackets((taxRows ?? []) as TaxBracket[]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profileId, supabase]);

  const persist = React.useCallback(
    async (next: IncomeForm) => {
      if (!profileId) return;
      setSaveState("saving");
      if (rowId.current) {
        await supabase.from("income_settings").update(next).eq("id", rowId.current);
      } else {
        const { data } = await supabase
          .from("income_settings")
          .insert({ ...next, profile_id: profileId })
          .select()
          .single();
        if (data) rowId.current = data.id;
      }
      setSaveState("saved");
    },
    [supabase, profileId],
  );

  const update = React.useCallback(
    <K extends keyof IncomeForm>(key: K, value: IncomeForm[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(next), SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [persist],
  );

  const bracketsForFilingStatus = React.useCallback(
    (status: FilingStatus) => brackets.filter((b) => b.filing_status === status),
    [brackets],
  );

  return { form, update, loading, saveState, brackets, bracketsForFilingStatus };
}

export const INCOME_MODES: { value: IncomeMode; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "salary", label: "Salary" },
];

export const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married filing jointly" },
  { value: "married_separate", label: "Married filing separately" },
  { value: "head_of_household", label: "Head of household" },
];
