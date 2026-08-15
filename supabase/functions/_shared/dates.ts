export type Recurrence = "monthly" | "biweekly" | "weekly" | "annual";

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First occurrence for a brand-new bill: the next due_day on/after today. */
export function firstOccurrenceDate(dueDay: number, today: Date = new Date()): string {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const clampedThisMonth = Math.min(dueDay, daysInMonth(year, month));
  const thisMonthDate = new Date(Date.UTC(year, month, clampedThisMonth));

  if (thisMonthDate >= startOfDay(today)) {
    return toISODate(thisMonthDate);
  }
  const clampedNextMonth = Math.min(dueDay, daysInMonth(year, month + 1));
  return toISODate(new Date(Date.UTC(year, month + 1, clampedNextMonth)));
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Advance a due_date by one recurrence interval, preserving the bill's due_day where relevant. */
export function nextOccurrenceDate(previousDueDate: string, recurrence: Recurrence, dueDay: number): string {
  const prev = new Date(`${previousDueDate}T00:00:00Z`);

  switch (recurrence) {
    case "weekly": {
      const next = new Date(prev);
      next.setUTCDate(next.getUTCDate() + 7);
      return toISODate(next);
    }
    case "biweekly": {
      const next = new Date(prev);
      next.setUTCDate(next.getUTCDate() + 14);
      return toISODate(next);
    }
    case "annual": {
      const next = new Date(Date.UTC(prev.getUTCFullYear() + 1, prev.getUTCMonth(), prev.getUTCDate()));
      return toISODate(next);
    }
    case "monthly":
    default: {
      const year = prev.getUTCFullYear();
      const month = prev.getUTCMonth() + 1;
      const targetYear = year + Math.floor(month / 12);
      const targetMonth = month % 12;
      const clamped = Math.min(dueDay, daysInMonth(targetYear, targetMonth));
      return toISODate(new Date(Date.UTC(targetYear, targetMonth, clamped)));
    }
  }
}
