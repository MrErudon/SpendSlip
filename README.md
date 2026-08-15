# SpendSlip

A bills, income, and paycheck-planning app. Microsoft To-Do–inspired: a
persistent sidebar, dark mode by default, and a blue (`#0078D4`) accent.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Supabase** — Postgres, Auth (password + magic link), Row Level Security,
  Edge Functions
- **Tailwind CSS v4** for styling, **Framer Motion** for the paycheck
  planner's drag-and-drop
- shadcn/ui-style components (Radix primitives + `class-variance-authority`)
- Deploys to **Vercel**

## Project layout

```
app/
  (auth)/login, (auth)/signup      Email+password and magic-link auth
  (app)/                           Sidebar shell + auth-gated pages
    bills/ income/ planner/ shared/ dashboard/ settings/
  auth/callback/route.ts           Magic-link session exchange
  api/account/route.ts             Account deletion (service role)
lib/
  supabase/{client,server,middleware}.ts
  types.ts                         Domain types + DB schema reference
  tax.ts                           2026 federal bracket + FICA estimator
  dates.ts                         Bill recurrence date math
  hooks/                           Data hooks (bills, income, planner, …)
  profile-context.tsx              Active budget profile (client context)
components/                        Feature components + components/ui/*
supabase/
  migrations/                      Full schema, RLS, triggers, tax seed data
  functions/rollover-bills/        Monthly bill occurrence generator (cron)
  functions/send-reminders/        Daily email reminders via Resend (cron)
```

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
