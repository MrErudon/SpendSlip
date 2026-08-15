-- Schedules the two Edge Functions via pg_cron + pg_net.
--
-- IMPORTANT: replace the placeholders below (project ref + service role
-- key) before/after running this migration against your project, or set
-- them as Vault secrets and reference those instead. The simplest path:
--   1. Deploy the functions: `supabase functions deploy rollover-bills`
--      and `supabase functions deploy send-reminders`.
--   2. In the SQL editor, run this file with YOUR_PROJECT_REF and
--      YOUR_SERVICE_ROLE_KEY substituted (Settings -> API in the
--      dashboard has both).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'rollover-bills-monthly',
  '0 0 1 * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/rollover-bills',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-reminders-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
