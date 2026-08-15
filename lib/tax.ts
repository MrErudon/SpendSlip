import type { FilingStatus, TaxBracket } from "@/lib/types";

/**
 * 2026 federal tax bracket estimates.
 *
 * The 10% and 37% thresholds for Single, MFJ, and Head of Household below
 * are confirmed 2026 figures (IRS inflation adjustments incorporating the
 * One Big Beautiful Bill Act). The interior thresholds (12/22/24/32/35%)
 * are reconstructed from the published 2025 IRS tables using the observed
 * 2025->2026 adjustment factors and the standard TCJA-era bracket
 * relationships (MFJ = 2x Single except the top bracket which is 1.2x;
 * MFS = MFJ / 2; HoH matches Single from the 24% bracket up). Treat these
 * as a well-informed estimate, not a filing-grade source — this powers an
 * in-app take-home estimate, and users can always bypass it with a flat
 * rate override. Update this table (or the `tax_brackets` DB table it
 * mirrors) once the IRS Revenue Procedure figures are verified.
 */
export const TAX_BRACKETS_2026: Record<FilingStatus, { min: number; max: number | null; rate: number }[]> = {
  single: [
    { min: 0, max: 12_400, rate: 0.1 },
    { min: 12_400, max: 49_600, rate: 0.12 },
    { min: 49_600, max: 105_700, rate: 0.22 },
    { min: 105_700, max: 201_800, rate: 0.24 },
    { min: 201_800, max: 256_225, rate: 0.32 },
    { min: 256_225, max: 640_600, rate: 0.35 },
    { min: 640_600, max: null, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 24_800, rate: 0.1 },
    { min: 24_800, max: 99_200, rate: 0.12 },
    { min: 99_200, max: 211_400, rate: 0.22 },
    { min: 211_400, max: 403_600, rate: 0.24 },
    { min: 403_600, max: 512_450, rate: 0.32 },
    { min: 512_450, max: 768_700, rate: 0.35 },
    { min: 768_700, max: null, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 12_400, rate: 0.1 },
    { min: 12_400, max: 49_600, rate: 0.12 },
    { min: 49_600, max: 105_700, rate: 0.22 },
    { min: 105_700, max: 201_800, rate: 0.24 },
    { min: 201_800, max: 256_225, rate: 0.32 },
    { min: 256_225, max: 384_350, rate: 0.35 },
    { min: 384_350, max: null, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 17_700, rate: 0.1 },
    { min: 17_700, max: 67_450, rate: 0.12 },
    { min: 67_450, max: 105_700, rate: 0.22 },
    { min: 105_700, max: 201_800, rate: 0.24 },
    { min: 201_800, max: 256_225, rate: 0.32 },
    { min: 256_225, max: 640_600, rate: 0.35 },
    { min: 640_600, max: null, rate: 0.37 },
  ],
};

export const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 16_100,
  married_joint: 32_200,
  married_separate: 16_100,
  head_of_household: 24_150,
};

export const FICA_RATE = 0.0765; // 6.2% Social Security + 1.45% Medicare
const SOCIAL_SECURITY_WAGE_BASE_2026 = 184_500; // approximate, verify against SSA release
const MEDICARE_SURTAX_RATE = 0.009; // additional 0.9% Medicare on high earners (not inflation-indexed)
const MEDICARE_SURTAX_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  married_joint: 250_000,
  married_separate: 125_000,
  head_of_household: 200_000,
};

/** Progressive federal income tax on taxable (post-deduction) annual income. */
export function federalTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  brackets: { min: number; max: number | null; rate: number }[] = TAX_BRACKETS_2026[filingStatus],
): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const top = bracket.max ?? Infinity;
    const taxedInBracket = Math.min(taxableIncome, top) - bracket.min;
    tax += taxedInBracket * bracket.rate;
  }
  return tax;
}

/** FICA (Social Security + Medicare, plus the additional Medicare surtax). */
export function ficaTax(grossAnnualIncome: number, filingStatus: FilingStatus): number {
  const socialSecurity = Math.min(grossAnnualIncome, SOCIAL_SECURITY_WAGE_BASE_2026) * 0.062;
  const medicare = grossAnnualIncome * 0.0145;
  const surtaxThreshold = MEDICARE_SURTAX_THRESHOLD[filingStatus];
  const surtax = Math.max(0, grossAnnualIncome - surtaxThreshold) * MEDICARE_SURTAX_RATE;
  return socialSecurity + medicare + surtax;
}

export interface TaxEstimateInput {
  grossAnnualIncome: number;
  filingStatus: FilingStatus;
  stateRate: number; // e.g. 0.05 for 5% flat state tax
  flatRateOverride: number | null; // if set, replaces the entire federal+state calc with a single flat rate
  brackets?: { min: number; max: number | null; rate: number }[];
}

export interface TaxEstimateResult {
  grossAnnual: number;
  federal: number;
  fica: number;
  state: number;
  totalTax: number;
  netAnnual: number;
  effectiveRate: number;
}

/** Full annual tax estimate: federal (bracketed) + FICA + flat state rate. */
export function estimateTax(input: TaxEstimateInput): TaxEstimateResult {
  const { grossAnnualIncome, filingStatus, stateRate, flatRateOverride, brackets } = input;
  const gross = Math.max(0, grossAnnualIncome);

  if (flatRateOverride !== null && flatRateOverride !== undefined) {
    const totalTax = gross * flatRateOverride;
    return {
      grossAnnual: gross,
      federal: totalTax,
      fica: 0,
      state: 0,
      totalTax,
      netAnnual: gross - totalTax,
      effectiveRate: gross > 0 ? totalTax / gross : 0,
    };
  }

  const deduction = STANDARD_DEDUCTION_2026[filingStatus];
  const taxable = Math.max(0, gross - deduction);
  const federal = federalTax(taxable, filingStatus, brackets);
  const fica = ficaTax(gross, filingStatus);
  const state = gross * Math.max(0, stateRate);
  const totalTax = federal + fica + state;

  return {
    grossAnnual: gross,
    federal,
    fica,
    state,
    totalTax,
    netAnnual: gross - totalTax,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
  };
}

/** Convert DB tax_brackets rows for one filing status into the shape estimateTax expects. */
export function bracketsFromRows(rows: TaxBracket[]): { min: number; max: number | null; rate: number }[] {
  return [...rows]
    .sort((a, b) => a.bracket_order - b.bracket_order)
    .map((r) => ({ min: r.min_income, max: r.max_income, rate: r.rate }));
}

// --- Hourly / OT helpers -----------------------------------------------

const WEEKS_PER_MONTH = 4.33;
const REGULAR_HOURS_PER_WEEK = 40;

export interface HourlyGrossInput {
  hourlyRate: number;
  hoursPerWeek: number;
}

/** Monthly gross pay from an hourly rate, applying 1.5x OT above 40 hrs/week. */
export function hourlyMonthlyGross({ hourlyRate, hoursPerWeek }: HourlyGrossInput): number {
  const regularHours = Math.min(hoursPerWeek, REGULAR_HOURS_PER_WEEK);
  const otHours = Math.max(0, hoursPerWeek - REGULAR_HOURS_PER_WEEK);
  const weeklyGross = regularHours * hourlyRate + otHours * hourlyRate * 1.5;
  return weeklyGross * WEEKS_PER_MONTH;
}

/** Effective hourly OT rate (1.5x base). */
export function otRate(hourlyRate: number): number {
  return hourlyRate * 1.5;
}

/**
 * Hours of OT needed per week to close a monthly income gap, given the
 * take-home (net) OT rate — i.e. the OT hourly rate after the estimated
 * effective tax rate is applied.
 */
export function hoursNeededForGap(monthlyGap: number, netOtHourlyRate: number): number {
  if (monthlyGap <= 0 || netOtHourlyRate <= 0) return 0;
  const weeklyGapCovered = monthlyGap / WEEKS_PER_MONTH;
  return weeklyGapCovered / netOtHourlyRate;
}

/** Break-even hours/week (at the given hourly rate) to cover a monthly amount. */
export function breakEvenHours(monthlyAmount: number, hourlyRate: number): number {
  if (monthlyAmount <= 0 || hourlyRate <= 0) return 0;
  return monthlyAmount / WEEKS_PER_MONTH / hourlyRate;
}
