-- Seed 2026 federal tax brackets. Kept in sync with lib/tax.ts
-- (TAX_BRACKETS_2026) — see the comment there for sourcing notes: the
-- 10%/37% thresholds are confirmed 2026 IRS figures, interior brackets are
-- a well-informed reconstruction. Update both places together.

insert into public.tax_brackets (year, filing_status, bracket_order, min_income, max_income, rate) values
  -- single
  (2026, 'single', 1, 0,       12400,  0.10),
  (2026, 'single', 2, 12400,   49600,  0.12),
  (2026, 'single', 3, 49600,   105700, 0.22),
  (2026, 'single', 4, 105700,  201800, 0.24),
  (2026, 'single', 5, 201800,  256225, 0.32),
  (2026, 'single', 6, 256225,  640600, 0.35),
  (2026, 'single', 7, 640600,  null,   0.37),
  -- married filing jointly
  (2026, 'married_joint', 1, 0,       24800,  0.10),
  (2026, 'married_joint', 2, 24800,   99200,  0.12),
  (2026, 'married_joint', 3, 99200,   211400, 0.22),
  (2026, 'married_joint', 4, 211400,  403600, 0.24),
  (2026, 'married_joint', 5, 403600,  512450, 0.32),
  (2026, 'married_joint', 6, 512450,  768700, 0.35),
  (2026, 'married_joint', 7, 768700,  null,   0.37),
  -- married filing separately
  (2026, 'married_separate', 1, 0,       12400,  0.10),
  (2026, 'married_separate', 2, 12400,   49600,  0.12),
  (2026, 'married_separate', 3, 49600,   105700, 0.22),
  (2026, 'married_separate', 4, 105700,  201800, 0.24),
  (2026, 'married_separate', 5, 201800,  256225, 0.32),
  (2026, 'married_separate', 6, 256225,  384350, 0.35),
  (2026, 'married_separate', 7, 384350,  null,   0.37),
  -- head of household
  (2026, 'head_of_household', 1, 0,      17700,  0.10),
  (2026, 'head_of_household', 2, 17700,  67450,  0.12),
  (2026, 'head_of_household', 3, 67450,  105700, 0.22),
  (2026, 'head_of_household', 4, 105700, 201800, 0.24),
  (2026, 'head_of_household', 5, 201800, 256225, 0.32),
  (2026, 'head_of_household', 6, 256225, 640600, 0.35),
  (2026, 'head_of_household', 7, 640600, null,   0.37)
on conflict (year, filing_status, bracket_order) do nothing;
