import type { Recurrence } from "@/lib/types";

/** Days in a given local month (0-indexed month). */
function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The first occurrence date for a brand-new bill: the next due_day on or
 * after today. Mirrors the logic in
 * supabase/functions/_shared/dates.ts so client-created bills line up
 * with what the rollover Edge Function would generate.
 */
export function firstOccurrenceDate(dueDay: number, today: Date = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  const clampedThisMonth = Math.min(dueDay, daysInMonth(year, month));
  const thisMonthDate = new Date(year, month, clampedThisMonth);
  const startToday = new Date(year, month, today.getDate());

  if (thisMonthDate >= startToday) {
    return toISODate(thisMonthDate);
  }
  const clampedNextMonth = Math.min(dueDay, daysInMonth(year, month + 1));
  return toISODate(new Date(year, month + 1, clampedNextMonth));
}

export function nextOccurrenceDate(previousDueDate: string, recurrence: Recurrence, dueDay: number): string {
  const [y, m, d] = previousDueDate.split("-").map(Number);
  const prev = new Date(y, m - 1, d);

  switch (recurrence) {
    case "weekly": {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return toISODate(next);
    }
    case "biweekly": {
      const next = new Date(prev);
      next.setDate(next.getDate() + 14);
      return toISODate(next);
    }
    case "annual": {
      return toISODate(new Date(prev.getFullYear() + 1, prev.getMonth(), prev.getDate()));
    }
    case "monthly":
    default: {
      const targetYear = prev.getFullYear() + Math.floor((prev.getMonth() + 1) / 12);
      const targetMonth = (prev.getMonth() + 1) % 12;
      const clamped = Math.min(dueDay, daysInMonth(targetYear, targetMonth));
      return toISODate(new Date(targetYear, targetMonth, clamped));
    }
  }
}
