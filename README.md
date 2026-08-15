# SpendSlip

A bills, income, paycheck-planning, and statement-import budgeting app.
Microsoft To-Do–inspired: a persistent sidebar, dark mode by default, and a
blue (`#0078D4`) accent. See `docs/statement-import-expansion-plan.md` for
the architecture behind the transaction-ledger half of the app.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Supabase** — Postgres, Auth (password + magic link), Row Level Security,
  Edge Functions, Storage
- **Tailwind CSS v4** for styling, **Framer Motion** for the paycheck
  planner's drag-and-drop
- shadcn/ui-style components (Radix primitives + `class-variance-authority`)
- **papaparse** / **pdf-parse** for statement parsing, **Vitest** for unit
  tests on the financial logic
- Deploys to **Vercel**

## Project layout

```
app/
  (auth)/login, (auth)/signup      Email+password and magic-link auth
  (app)/                           Sidebar shell + auth-gated pages
    bills/ income/ planner/ shared/ dashboard/ settings/
    statements/                    Upload, preview, import statements
    transactions/                  Paginated ledger, filters, bulk actions
    subscriptions/                 Detected recurring charges
    insights/                      Category breakdown, trends, suggested budget, forecast
  auth/callback/route.ts           Magic-link session exchange
  api/account/route.ts             Account deletion (service role)
  api/statements/{parse,import}/   Statement parsing + import pipeline
lib/
  supabase/{client,server,middleware}.ts
  types.ts / types-financial.ts    Domain types + DB schema reference
  tax.ts                           2026 federal bracket + FICA estimator
  dates.ts                         Bill recurrence date math
  statements/                      Parsing, normalization, categorization,
                                    fingerprinting, transfer/recurring detection,
                                    budget generator, forecasting (all pure/tested)
  ai/financial-classifier.ts       Optional, narrowly-scoped AI fallback
  hooks/                           Data hooks (bills, income, planner, transactions, …)
  profile-context.tsx              Active budget profile (client context)
components/                        Feature components + components/ui/*
supabase/
  migrations/                      Full schema, RLS, triggers, seed data
  functions/rollover-bills/        Monthly bill occurrence generator (cron)
  functions/send-reminders/        Daily email reminders via Resend (cron)
scripts/seed-demo-data.ts          Dev-only demo transaction seeder
```

## Statement import, transactions & budgeting

Upload a CSV or PDF bank/credit-card statement on the **Statements** page.
SpendSlip parses it, normalizes merchant names, categorizes each
transaction (merchant rules → history → built-in keywords → optional AI →
Needs Review), fingerprints every row to catch duplicate imports, and
detects transfers/credit-card payments so they don't get double-counted as
spending. Corrections you make become merchant rules that apply to future
imports automatically. Recurring charges surface on **Subscriptions**;
**Insights** turns the accumulated history into category trends, a
suggested monthly budget, and a transparent month-end forecast.

Raw statement files are deleted right after parsing by default — enable
"Keep original statement files" in Settings to retain them in a private,
per-user Supabase Storage bucket instead.

To try it with realistic data instead of uploading real statements:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run seed:demo -- you@example.com
```

This is a dev-only script (not reachable from the app itself) that seeds
~3 months of transactions covering income, subscriptions, groceries,
dining, gas, a large one-off purchase, a refund, and a checking→credit-card
payment pair, onto a "Demo Checking" and "Demo Credit Card" account.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in `supabase/migrations/` in order (via the SQL
   editor, or `supabase db push` with the CLI linked to your project).
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy rollover-bills
   supabase functions deploy send-reminders
   ```
4. Schedule them — the simplest path is `supabase/migrations/20260101000004_cron_jobs.sql`,
   which sets up `pg_cron` + `pg_net` to call both functions on a schedule.
   Replace the `YOUR_PROJECT_REF` / `YOUR_SERVICE_ROLE_KEY` placeholders in
   that file with your project's values before running it (Settings → API
   in the dashboard has both). Alternatively, use the Dashboard's
   Edge Functions → Cron UI.
5. In **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` (and your production URL) as a
   redirect URL so magic links work.
6. Set up [Resend](https://resend.com) and add `RESEND_API_KEY` to your
   Edge Function secrets (`supabase secrets set RESEND_API_KEY=...`) for
   `send-reminders` to actually deliver email.
7. If you enable "Keep original statement files" in Settings, statement
   files are stored in the `statement-files` Storage bucket created by
   `supabase/migrations/20260101000007_statement_storage.sql`. No extra
   setup needed — the migration creates the bucket and its access policies.

### Running tests

```bash
npm run test
```

Covers the deterministic financial logic in `lib/statements/` and
`lib/tax.ts` — fingerprinting, duplicate/transfer/credit-card-payment
detection, merchant normalization, merchant-rule precedence, recurring
detection, budget generation, and forecasting.

### Environment variables

See `.env.example`. `NEXT_PUBLIC_*` values come from your Supabase
project's API settings; `SUPABASE_SERVICE_ROLE_KEY` is required for the
account-deletion route and is server-only — never expose it to the client.

## Notes on the 2026 tax brackets

`lib/tax.ts` (and the matching `tax_brackets` seed migration) use IRS-confirmed
2026 thresholds for the 10% and 37% bands per filing status, with the
interior brackets reconstructed from the 2025 published tables using the
observed year-over-year adjustment and standard bracket relationships
(MFJ = 2× Single except the top bracket; MFS = MFJ ÷ 2; Head of Household
matches Single from the 24% bracket up). Treat the results as a
well-informed estimate for budgeting, not a filing-grade source — a flat
rate override is available in Income settings for anyone who wants to
skip the bracket math entirely.

## Deployment

Deploy to [Vercel](https://vercel.com) — it auto-detects Next.js, no
`vercel.json` needed. Set these environment variables in the Vercel
project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (only needed by the Edge Function, not the Next app —
  set it via `supabase secrets set` instead, but harmless to keep in sync
  here too)
