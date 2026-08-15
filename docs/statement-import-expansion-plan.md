# Statement Import & Intelligent Budgeting — Expansion Plan

## 1. Current architecture (as of this plan)

**Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + Auth +
RLS + Edge Functions), Tailwind v4, Framer Motion, hand-built shadcn/ui-style
components (`components/ui/*`). Dark-mode-first, `#0078D4` accent, desktop
sidebar shell.

**Routing:**
- `app/(auth)/{login,signup}` — auth
- `app/(app)/layout.tsx` — server-side auth gate + `ProfileProvider` + `Sidebar`
- `app/(app)/{bills,income,planner,shared,dashboard,settings}/page.tsx`
- `app/auth/callback/route.ts` — magic link exchange
- `app/api/account/route.ts` — service-role account deletion
- `middleware.ts` + `lib/supabase/middleware.ts` — session refresh & route gate

**Data access pattern:** All feature pages are Client Components. Each
feature owns a `lib/hooks/use-*.ts` hook that wraps the browser Supabase
client (`lib/supabase/client.ts`), does its own `select`/`insert`/`update`,
and exposes state + mutators. There's no `Database` generic threaded into
the client (see the note in `lib/supabase/client.ts` — a supabase-js version
quirk collapses typed inserts to `never`); query results are cast to the
domain types in `lib/types.ts` at each call site instead. **This expansion
follows the same pattern.**

**Multi-tenancy unit:** `budget_profiles` (one user, many named profiles —
Personal, Business, etc.), selected client-side via `lib/profile-context.tsx`
(`ProfileProvider` / `useProfile()`), persisted to `localStorage`. Nearly
every domain table hangs off `profile_id`, and RLS enforces ownership via
`exists (select 1 from budget_profiles p where p.id = profile_id and
p.user_id = auth.uid())`. New tables in this expansion follow the same
`profile_id`-scoped RLS shape.

**Existing domain tables:** `budget_profiles`, `bill_categories`, `bills`,
`bill_occurrences`, `income_settings`, `paychecks`,
`bill_paycheck_allocations`, `shared_budgets`, `shared_budget_members`,
`shared_budget_income`, `goal_contributions`, `notification_settings`,
`tax_brackets`.

**UI patterns to reuse, not reinvent:**
- Edit-in-place uses a slide-in `Sheet` (`components/ui/sheet.tsx`), e.g.
  `components/bill-modal.tsx`. Transaction detail follows the same pattern.
- Tabs for category switching (`components/category-tabs.tsx`).
- Card-based metric grids on the dashboard (`Metric` in
  `app/(app)/dashboard/page.tsx`).
- `useMonthSummary`-style hooks compute derived stats client-side from raw
  rows rather than relying on DB views.
- Toasts via `sonner` (`components/ui/sonner.tsx`, already wired into
  `app/layout.tsx`).

## 2. Scope of this expansion

Add statement import (CSV first-class, PDF best-effort), transaction
storage, merchant normalization, categorization (rules → history → built-ins
→ keywords → optional AI → needs-review), transfer/credit-card-payment
detection, duplicate detection via fingerprinting, recurring/subscription
detection integrated with the existing Bills feature, spending insights,
a suggested-budget generator, simple forecasting, and a review queue. No
Plaid/live bank sync, no chat UI, no investment/credit-score/tax features.

## 3. Schema changes

New migration files (additive, following the existing
`YYYYMMDDHHMMSS_description.sql` convention):

- `financial_accounts` — one row per checking/savings/credit-card/loan/cash
  account a user has statements for. Scoped to `budget_profiles`.
- `spending_categories` — separate from `bill_categories` (bills are
  recurring obligations; spending categories classify arbitrary
  transactions). Seeded with the standard set (Housing, Utilities,
  Groceries, …) per profile on first use, but user-manageable
  (rename/archive/emoji/budget amount/fixed-variable-discretionary tag).
- `statement_imports` — one row per uploaded file; tracks parse status,
  detected provider, date range, and (optionally) a pointer to the raw file
  in Storage.
- `transactions` — the core ledger. One row per parsed transaction, always
  linked to a `financial_account` and (when it came from an upload) a
  `statement_import`. Carries the fingerprint used for duplicate detection,
  transfer/credit-card-payment/refund/income flags, and category.
- `merchant_rules` — user-authored `raw pattern → normalized merchant +
  category` overrides, applied on every future import before any built-in
  or AI classification.
- `recurring_groups` — detected recurring charges (subscriptions, etc.),
  one row per merchant+amount+cadence cluster, optionally linked to a
  `bills` row once confirmed.

All new tables get RLS mirroring the existing `budget_profiles`-ownership
pattern, plus indexes on `user_id`/`profile_id`/`transaction_date`/
`normalized_merchant`/`fingerprint` as specified. A private Storage bucket
(`statement-files`) holds raw files **only** when a user opts into
"Keep original statement files" (default off); bucket policies restrict
access to `auth.uid()`-owned paths.

## 4. New routes

- `app/(app)/statements/page.tsx` — upload center + import history
- `app/(app)/transactions/page.tsx` — the transaction ledger (paginated table
  + slide-in detail panel)
- `app/(app)/subscriptions/page.tsx` — recurring charge review
- `app/(app)/insights/page.tsx` — category breakdown, trends, suggested
  budget, forecast
- Account management lives inside the existing `app/(app)/settings/page.tsx`
  (a new card), not a separate route.

## 5. New components (top-level; `components/ui/*` reused throughout)

`statement-uploader.tsx`, `statement-preview-table.tsx`,
`import-history-list.tsx`, `transaction-table.tsx`,
`transaction-detail-panel.tsx`, `transaction-filters.tsx`,
`bulk-action-bar.tsx`, `subscription-card.tsx`, `month-selector.tsx`
(reusable across Dashboard/Transactions/Insights/Subscriptions),
`category-breakdown-chart.tsx` (simple CSS/SVG bars, no charting dependency
added), `suggested-budget-card.tsx`, `insight-card.tsx`,
`review-queue-banner.tsx`.

## 6. Parsing architecture (`lib/statements/`)

- `parser.ts` — provider-agnostic entry point: `parseStatementFile(file):
  Promise<ParsedStatement>`. Dispatches to `csv-parser.ts` or
  `pdf-parser.ts` by MIME/extension, returns a normalized
  `{ rows: RawStatementRow[], detectedProvider, dateRange, warnings }`
  shape regardless of source format.
- `csv-parser.ts` — the reliable path. Header-sniffing column mapper (date/
  posted-date/description/amount/debit/credit/type columns detected by
  header name heuristics, not a fixed schema per bank) so it isn't
  hard-coded to one institution's export format.
- `pdf-parser.ts` — best-effort text-extraction + line-item regex parsing.
  When confidence is low, returns `{ ok: false, reason }` rather than
  guessing — the UI then tells the user "this statement format could not be
  parsed automatically" and offers CSV upload / manual entry instead of
  silently importing bad data.
- `detect-provider.ts` — lightweight heuristics (header names, filename,
  boilerplate phrases) to label an import "Chase", "Amex", "Capital One",
  etc. for display only; parsing itself never branches on a hard-coded
  provider list.
- `normalize.ts` — merchant normalization pipeline: strip POS noise
  (`SQ *`, `TST*`, trailing store/terminal numbers), apply a small built-in
  alias table, then user `merchant_rules`, with an optional AI fallback
  slot (see §9).
- `transaction-fingerprint.ts` — deterministic hash of
  `(financial_account_id, amount, transaction_date, normalized description,
  posted_date?)` used for duplicate detection both within a single import
  and against previously-imported transactions.
- `categorize.ts` — categorization order: merchant rule → prior
  normalized-merchant history → built-in keyword/merchant map → AI fallback
  (if configured) → "Needs Review".
- `transfers.ts` — transfer / credit-card-payment detection: same-user
  cross-account matching (opposite-signed amount within a small date window
  across two of the user's own accounts) plus single-sided heuristics
  (description contains "PAYMENT", "TRANSFER TO/FROM", `direction`/account
  type combination) for when the counterpart account has no statement
  uploaded yet.
- `recurring.ts` — groups transactions by normalized merchant + similar
  amount, checks interval regularity against the supported cadences
  (weekly/biweekly/monthly/quarterly/semiannual/annual), and produces
  `recurring_groups` candidates with a confidence score.
- `budget-generator.ts` / `forecast.ts` — pure functions over
  already-loaded transaction/bill/paycheck data (mirrors the existing
  `lib/tax.ts` style: framework-free, unit-testable).

## 7. Security considerations

- RLS on every new table, scoped through `budget_profiles.user_id =
  auth.uid()` exactly like existing tables — never `user_id` alone, so
  profile-switching semantics stay consistent.
- Shared budgets are unaffected: they already only aggregate
  `shared_budget_income` (a number the member enters) and
  `goal_contributions`. Nothing in this expansion writes transaction-level
  data into shared tables or exposes it through `shared_budget_*` RLS
  policies — that boundary is preserved by construction (new tables simply
  aren't referenced by any shared-budget policy).
- Raw statement files: parsed in a Route Handler (server-side), never
  logged; deleted immediately after successful parse unless the user has
  enabled "Keep original statement files" in Settings, in which case the
  file goes to a private per-user Storage path (`statements/{user_id}/...`)
  with a bucket policy restricting all operations to the owner.
- AI classification (§9) is opt-in, sends only short merchant-description
  strings (never full statements, account numbers, or identity fields), and
  the whole app must work with the AI adapter absent/unconfigured.

## 8. Duplicate / transfer / recurring logic — the load-bearing algorithms

These are the pieces the spec calls out as "critical" and requires tests
for. They live in pure, framework-free modules so they're trivially unit
testable (Vitest, added in this expansion — see §11):

- **Fingerprint** (`transaction-fingerprint.ts`): stable hash, same inputs
  → same fingerprint; a one-cent or one-day difference → different
  fingerprint.
- **Duplicate detection**: before insert, look up existing fingerprints for
  the account; matches are surfaced as "already imported" rather than
  silently re-inserted, with an explicit user choice (cancel / review /
  import non-duplicates only).
- **Transfer/credit-card-payment matching**: pairs are marked
  `is_transfer`/`is_credit_card_payment` and excluded from spending totals
  by default (still visible, editable, and overridable in the Transactions
  table — never hidden from the user, only excluded from aggregates).

## 9. AI adapter (optional, narrow)

`lib/ai/financial-classifier.ts` exports `classifyMerchant(description):
Promise<{merchant, category} | null>`, used only as the last automatic step
before "Needs Review" and only when `AI_CLASSIFIER_ENABLED`/an API key is
configured. No chat interface. No statement content ever leaves the server.

## 10. Implementation phases

Matches the task's required order; each phase ships buildable, lint-clean,
non-broken code before the next starts:

1. Schema + RLS + CSV import pipeline + `transactions`/`financial_accounts`/
   `statement_imports` CRUD + minimal Statements page (upload → preview →
   import, no transfer/recurring detection yet).
2. Transactions page (table, filters, slide-in detail, bulk actions),
   merchant normalization, spending categories, merchant rules, duplicate
   detection wired into import.
3. Transfer/credit-card-payment detection, PDF parser (best-effort) +
   "couldn't parse" fallback UX, import review screen for uncertain matches.
4. Recurring/subscription detection, Subscriptions page, Bills integration
   (attach-to-bill / create-bill-from-recurring).
5. Insights page (category breakdown, MoM trend, top merchants, fixed vs.
   discretionary), suggested-budget generator, forecasting.
6. Dashboard integration (new metric cards, insight cards, upcoming
   recurring, review-queue count), reusable month selector, review queue
   UX, AI fallback classifier, account management in Settings, demo data,
   tests, final production-readiness pass.

## 11. Testing

Add `vitest` (lightweight, no existing test runner in the repo) with unit
tests for: fingerprinting, duplicate detection, transfer detection,
credit-card-payment suppression, merchant normalization, merchant-rule
precedence, recurring detection, and budget/forecast math. All of these are
pure-function modules under `lib/statements/` and `lib/tax.ts`-style, so no
Supabase mocking is required for the core logic tests.
