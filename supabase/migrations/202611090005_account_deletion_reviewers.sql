-- Calendar sync logs are shared data. Keep the log but remove the deleted reviewer's identity.
begin;

alter table public.calendar_sync_runs
  drop constraint if exists calendar_sync_runs_reviewed_by_fkey,
  add constraint calendar_sync_runs_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null;

commit;
