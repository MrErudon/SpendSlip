-- Private storage for raw statement files, only used when a user opts
-- into "Keep original statement files" (default off — see the
-- keep_statement_files column added below). Objects are stored at
-- `{user_id}/{statement_import_id}/{filename}` so path-prefix RLS is
-- sufficient to keep files scoped to their owner.

insert into storage.buckets (id, name, public)
values ('statement-files', 'statement-files', false)
on conflict (id) do nothing;

create policy "statement-files: owner select" on storage.objects
  for select using (
    bucket_id = 'statement-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "statement-files: owner insert" on storage.objects
  for insert with check (
    bucket_id = 'statement-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "statement-files: owner delete" on storage.objects
  for delete using (
    bucket_id = 'statement-files' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Per-user preference: default OFF. When off, raw statement files are
-- deleted immediately after successful parsing instead of being uploaded
-- to the bucket above.
alter table public.notification_settings
  add column keep_statement_files boolean not null default false;
