-- Requires 202611050001_accounts.sql. Run once in Supabase SQL Editor.
-- Does not assign existing personal data to any institution or account.
begin;

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 2 and 200),
  created_at timestamptz not null default now()
);
insert into public.institutions(slug, name) values ('hit', 'HIT — מכון טכנולוגי חולון');

-- Deliberately separate from editable profile/user_metadata: users cannot promote themselves.
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
create function public.is_app_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated, service_role;

create table public.student_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  active_academic_year_id uuid references public.academic_years(id) on delete set null,
  degree text not null default '', track text not null default '',
  specialization text not null default '', student_status text not null default '',
  goal text not null default '', english_level text not null default '',
  study_year text not null default ''
);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null unique references public.institutions(id),
  page_url text not null,
  adapter text not null default 'hit-v1' check (adapter = 'hit-v1'),
  enabled boolean not null default true,
  auto_publish_new_years boolean not null default false,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  lease_until timestamptz,
  check (page_url ~ '^https://(www\.)?hit\.ac\.il/[^?#]*$')
);
insert into public.calendar_sources(institution_id, page_url)
select id, 'https://www.hit.ac.il/students/calender/' from public.institutions where slug = 'hit';

-- Shared calendars are separate from personal academic_years.
create table public.institution_calendars (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  start_year integer not null check (start_year between 2000 and 2200),
  label text not null,
  semester_a_start date, semester_a_end date,
  semester_b_start date, semester_b_end date,
  semester_c_start date, semester_c_end date,
  -- Only explicit full-day cancellations. Partial days stay in source notes for review.
  excluded_dates date[] not null default '{}',
  notes text not null default '',
  source_url text,
  source_hash text,
  origin text not null default 'manual' check (origin in ('manual', 'sync')),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  unique(institution_id, start_year),
  check ((semester_a_start is null) = (semester_a_end is null)),
  check ((semester_b_start is null) = (semester_b_end is null)),
  check ((semester_c_start is null) = (semester_c_end is null)),
  check (semester_a_start <= semester_a_end and semester_b_start <= semester_b_end and semester_c_start <= semester_c_end),
  check (semester_a_start is not null or semester_b_start is not null or semester_c_start is not null)
);
create function public.bump_calendar_revision() returns trigger
language plpgsql set search_path = '' as $$
begin new.revision := old.revision + 1; new.updated_at := now(); return new; end $$;
create trigger calendar_revision before update on public.institution_calendars
for each row execute function public.bump_calendar_revision();

create table public.calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.calendar_sources(id),
  created_at timestamptz not null default now(),
  status text not null check (status in ('unchanged','published','review','failed','approved','dismissed')),
  message text not null default '',
  candidate jsonb,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);
create index calendar_runs_recent on public.calendar_sync_runs(source_id, created_at desc);

alter table public.academic_years
  add column institution_id uuid references public.institutions(id),
  add column calendar_id uuid references public.institution_calendars(id),
  add column calendar_revision integer,
  add column date_mode text not null default 'manual' check (date_mode in ('manual','calendar')),
  add column excluded_dates date[] not null default '{}';
create unique index one_personal_copy_per_calendar on public.academic_years(user_id, calendar_id) where calendar_id is not null;

alter table public.institutions enable row level security;
alter table public.student_profiles enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.institution_calendars enable row level security;
alter table public.calendar_sync_runs enable row level security;
revoke all on public.institutions, public.student_profiles, public.calendar_sources, public.institution_calendars, public.calendar_sync_runs from anon, authenticated;
grant select, insert, update on public.institutions, public.student_profiles, public.calendar_sources, public.institution_calendars to authenticated;
grant select on public.calendar_sync_runs to authenticated;
grant all on public.institutions, public.student_profiles, public.calendar_sources, public.institution_calendars, public.calendar_sync_runs, public.app_admins to service_role;

create policy institutions_read on public.institutions for select to authenticated using (true);
create policy institutions_admin on public.institutions for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy calendars_read on public.institution_calendars for select to authenticated using (true);
create policy calendars_admin on public.institution_calendars for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy sources_admin on public.calendar_sources for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy runs_admin on public.calendar_sync_runs for select to authenticated using (public.is_app_admin());
create policy profiles_owner on public.student_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and (active_academic_year_id is null or exists (
  select 1 from public.academic_years y where y.id = active_academic_year_id and y.user_id = (select auth.uid())
)));

-- Atomic, explicit adoption. Re-applying overwrites only this user's date settings,
-- never existing courses, attendance or notes. An advisory lock prevents duplicate copies.
create function public.adopt_institution_calendar(p_calendar_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c public.institution_calendars; target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text || p_calendar_id::text));
  select * into strict c from public.institution_calendars where id = p_calendar_id;
  select id into target_id from public.academic_years where user_id = auth.uid() and calendar_id = c.id;
  if target_id is null then
    insert into public.academic_years(user_id,label,institution_id,calendar_id,calendar_revision,date_mode,
      semester_a_start,semester_a_end,semester_b_start,semester_b_end,semester_c_start,semester_c_end,excluded_dates)
    values(auth.uid(),c.label,c.institution_id,c.id,c.revision,'calendar',c.semester_a_start,c.semester_a_end,
      c.semester_b_start,c.semester_b_end,c.semester_c_start,c.semester_c_end,c.excluded_dates) returning id into target_id;
  else
    update public.academic_years set label=c.label,institution_id=c.institution_id,calendar_revision=c.revision,date_mode='calendar',
      semester_a_start=c.semester_a_start,semester_a_end=c.semester_a_end,semester_b_start=c.semester_b_start,
      semester_b_end=c.semester_b_end,semester_c_start=c.semester_c_start,semester_c_end=c.semester_c_end,excluded_dates=c.excluded_dates
      where id=target_id;
  end if;
  insert into public.student_profiles(user_id,institution_id,active_academic_year_id) values(auth.uid(),c.institution_id,target_id)
  on conflict(user_id) do update set institution_id=excluded.institution_id,active_academic_year_id=excluded.active_academic_year_id;
  return target_id;
end $$;
revoke all on function public.adopt_institution_calendar(uuid) from public;
grant execute on function public.adopt_institution_calendar(uuid) to authenticated;

-- Service-only lease: cron and manual sync cannot run the same source concurrently.
create function public.claim_calendar_source(p_source_id uuid) returns boolean
language sql security invoker set search_path = '' as $$
  with claimed as (
    update public.calendar_sources set lease_until=now()+interval '5 minutes'
    where id=p_source_id and enabled and (lease_until is null or lease_until<now())
    returning id
  ) select exists(select 1 from claimed)
$$;
revoke all on function public.claim_calendar_source(uuid) from public, anon, authenticated;
grant execute on function public.claim_calendar_source(uuid) to service_role;

-- Review is transactional; clients cannot forge the institution or approve twice.
create function public.review_calendar_run(p_run_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.calendar_sync_runs; inst uuid; c public.institution_calendars;
begin
  if not public.is_app_admin() then raise exception 'Administrator required'; end if;
  select * into strict r from public.calendar_sync_runs where id=p_run_id for update;
  if r.status <> 'review' then raise exception 'Already reviewed'; end if;
  if p_approve then
    if r.candidate is null then raise exception 'Missing candidate'; end if;
    select institution_id into strict inst from public.calendar_sources where id=r.source_id;
    select * into c from jsonb_populate_record(null::public.institution_calendars, r.candidate);
    insert into public.institution_calendars(institution_id,start_year,label,semester_a_start,semester_a_end,
      semester_b_start,semester_b_end,semester_c_start,semester_c_end,excluded_dates,notes,source_url,source_hash,origin)
    values(inst,c.start_year,c.label,c.semester_a_start,c.semester_a_end,c.semester_b_start,c.semester_b_end,
      c.semester_c_start,c.semester_c_end,coalesce(c.excluded_dates,'{}'),coalesce(c.notes,''),c.source_url,c.source_hash,'sync')
    on conflict(institution_id,start_year) do update set label=excluded.label,semester_a_start=excluded.semester_a_start,
      semester_a_end=excluded.semester_a_end,semester_b_start=excluded.semester_b_start,semester_b_end=excluded.semester_b_end,
      semester_c_start=excluded.semester_c_start,semester_c_end=excluded.semester_c_end,excluded_dates=excluded.excluded_dates,
      notes=excluded.notes,source_url=excluded.source_url,source_hash=excluded.source_hash,origin='sync';
  end if;
  update public.calendar_sync_runs set status=case when p_approve then 'approved' else 'dismissed' end,
    reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
end $$;
revoke all on function public.review_calendar_run(uuid,boolean) from public;
grant execute on function public.review_calendar_run(uuid,boolean) to authenticated;
commit;
