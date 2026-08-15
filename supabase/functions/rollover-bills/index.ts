// Supabase Edge Function: rollover-bills
// Cron: 0 0 1 * * (00:00 UTC on the 1st of every month)
//
// For every active bill, ensures there is always at least one upcoming
// (or current) bill_occurrence on the books, generating forward until a
// ~35 day horizon is covered. Monthly bills get one new occurrence a
// month; weekly/biweekly bills get several per run so the planner always
// has a full month of upcoming due dates to schedule against.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { firstOccurrenceDate, nextOccurrenceDate, type Recurrence } from "../_shared/dates.ts";

const HORIZON_DAYS = 35;

interface BillRow {
  id: string;
  profile_id: string;
  amount: number;
  due_day: number;
  recurrence: Recurrence;
  active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bills, error: billsError } = await supabase
    .from("bills")
    .select("id, profile_id, amount, due_day, recurrence, active")
    .eq("active", true);

  if (billsError) {
    return json({ error: billsError.message }, 500);
  }

  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + HORIZON_DAYS);

  let created = 0;
  const errors: { bill_id: string; message: string }[] = [];

  for (const bill of (bills ?? []) as BillRow[]) {
    try {
      const { data: latest } = await supabase
        .from("bill_occurrences")
        .select("due_date")
        .eq("bill_id", bill.id)
        .order("due_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextDue = latest
        ? nextOccurrenceDate(latest.due_date, bill.recurrence, bill.due_day)
        : firstOccurrenceDate(bill.due_day);

      // For a brand-new bill, the "first" occurrence itself needs inserting too.
      const toInsert: { due_date: string; period_key: string }[] = [];
      if (!latest) {
        toInsert.push({ due_date: nextDue, period_key: nextDue });
        nextDue = nextOccurrenceDate(nextDue, bill.recurrence, bill.due_day);
      }

      while (new Date(`${nextDue}T00:00:00Z`) <= horizon) {
        toInsert.push({ due_date: nextDue, period_key: nextDue });
        nextDue = nextOccurrenceDate(nextDue, bill.recurrence, bill.due_day);
      }

      if (toInsert.length === 0) continue;

      const { error: insertError, count } = await supabase
        .from("bill_occurrences")
        .upsert(
          toInsert.map((o) => ({
            bill_id: bill.id,
            profile_id: bill.profile_id,
            due_date: o.due_date,
            period_key: o.period_key,
            amount: bill.amount,
            paid: false,
          })),
          { onConflict: "bill_id,period_key", ignoreDuplicates: true, count: "exact" },
        );

      if (insertError) throw insertError;
      created += count ?? toInsert.length;
    } catch (err) {
      errors.push({ bill_id: bill.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return json({ ok: true, bills_processed: bills?.length ?? 0, occurrences_created: created, errors });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
