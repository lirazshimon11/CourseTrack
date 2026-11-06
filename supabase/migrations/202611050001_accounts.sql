-- Existing records remain unclaimed until assigned to the verified original owner.
begin;
alter table public.academic_years add column if not exists user_id uuid references auth.users(id);
alter table public.courses add column if not exists user_id uuid references auth.users(id);
alter table public.academic_years alter column user_id set default auth.uid();
alter table public.courses alter column user_id set default auth.uid();
create index if not exists academic_years_user_id_idx on public.academic_years(user_id);
create index if not exists courses_user_id_idx on public.courses(user_id);
create index if not exists sessions_course_id_idx on public.sessions(course_id);
alter table public.academic_years enable row level security;
alter table public.courses enable row level security;
alter table public.sessions enable row level security;
-- Remove old permissive policies because policies combine with OR.
do $$ declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('academic_years', 'courses', 'sessions')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;
revoke all on public.academic_years, public.courses, public.sessions from anon;
grant select, insert, update, delete on public.academic_years, public.courses, public.sessions to authenticated;
create policy own_years on public.academic_years for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_courses on public.courses for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and
  (academic_year_id is null or exists (
    select 1 from public.academic_years y where y.id = academic_year_id and y.user_id = (select auth.uid())
  )));
create policy own_sessions on public.sessions for all to authenticated
using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create or replace function public.coursetrack_access_ready() returns boolean
language sql stable security invoker set search_path = ''
as $$ select auth.uid() is not null $$;
revoke all on function public.coursetrack_access_ready() from public, anon;
grant execute on function public.coursetrack_access_ready() to authenticated;
commit;
