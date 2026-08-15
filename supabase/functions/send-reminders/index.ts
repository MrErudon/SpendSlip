// Supabase Edge Function: send-reminders
// Cron: 0 8 * * * (08:00 UTC daily)
//
// For every user with email reminders enabled, finds unpaid bill
// occurrences due in N days (N = their configured reminder_days, e.g.
// [1, 3, 7]) and sends a single digest email via Resend.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "SpendSlip <reminders@spendslip.app>";

interface DueBill {
  name: string;
  amount: number;
  due_date: string;
  days_until: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  const { data: settings, error: settingsError } = await supabase
    .from("notification_settings")
    .select("user_id, reminder_days")
    .eq("email_reminders", true);

  if (settingsError) {
    return json({ error: settingsError.message }, 500);
  }

  const today = startOfDayUTC(new Date());
  let emailsSent = 0;
  const errors: { user_id: string; message: string }[] = [];

  for (const setting of settings ?? []) {
    try {
      const reminderDays: number[] = setting.reminder_days ?? [];
      if (reminderDays.length === 0) continue;

      const { data: profiles } = await supabase
        .from("budget_profiles")
        .select("id")
        .eq("user_id", setting.user_id);
      const profileIds = (profiles ?? []).map((p) => p.id);
      if (profileIds.length === 0) continue;

      const maxDays = Math.max(...reminderDays);
      const horizon = new Date(today);
      horizon.setUTCDate(horizon.getUTCDate() + maxDays);

      const { data: occurrences } = await supabase
        .from("bill_occurrences")
        .select("due_date, amount, paid, bills(name)")
        .in("profile_id", profileIds)
        .eq("paid", false)
        .gte("due_date", today.toISOString().slice(0, 10))
        .lte("due_date", horizon.toISOString().slice(0, 10));

      const due: DueBill[] = [];
      for (const occ of occurrences ?? []) {
        const dueDate = new Date(`${occ.due_date}T00:00:00Z`);
        const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
        if (reminderDays.includes(daysUntil)) {
          const billName = (occ.bills as unknown as { name: string } | null)?.name ?? "Bill";
          due.push({ name: billName, amount: occ.amount, due_date: occ.due_date, days_until: daysUntil });
        }
      }

      if (due.length === 0) continue;

      const { data: userRes } = await supabase.auth.admin.getUserById(setting.user_id);
      const email = userRes?.user?.email;
      if (!email) continue;

      if (resendApiKey) {
        await sendReminderEmail(resendApiKey, email, due);
      }
      emailsSent += 1;
    } catch (err) {
      errors.push({ user_id: setting.user_id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return json({ ok: true, users_checked: settings?.length ?? 0, emails_sent: emailsSent, errors });
});

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function sendReminderEmail(apiKey: string, to: string, bills: DueBill[]) {
  const rows = bills
    .sort((a, b) => a.days_until - b.days_until)
    .map(
      (b) =>
        `<tr><td style="padding:6px 12px;">${escapeHtml(b.name)}</td><td style="padding:6px 12px;">$${b.amount.toFixed(2)}</td><td style="padding:6px 12px;">${b.due_date} (${describeDays(b.days_until)})</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#0078D4;">Upcoming bills</h2>
      <p>You have ${bills.length} bill${bills.length === 1 ? "" : "s"} coming up:</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin-top:16px;color:#666;font-size:12px;">Sent by SpendSlip. Manage reminder preferences in Settings.</p>
    </div>`;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `${bills.length} bill${bills.length === 1 ? "" : "s"} due soon`,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
  }
}

function describeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
