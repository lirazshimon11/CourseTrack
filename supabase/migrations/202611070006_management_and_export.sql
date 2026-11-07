-- Bounded audit history, institution management, and complete personal export.
begin;
create or replace function public.trim_calendar_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.calendar_sources where id=new.source_id for update;
  delete from public.calendar_sync_runs where source_id=new.source_id and id not in (
    select id from public.calendar_sync_runs where source_id=new.source_id order by created_at desc,id desc limit 10
  );
  return new;
end $$;
create trigger calendar_history_limit after insert on public.calendar_sync_runs
for each row execute function public.trim_calendar_history();
delete from public.calendar_sync_runs where id in (
  select id from (select id,row_number() over(partition by source_id order by created_at desc,id desc) as position from public.calendar_sync_runs) ranked where position>10
);

alter table public.calendar_sources drop constraint calendar_sources_adapter_check;
alter table public.calendar_sources add constraint calendar_sources_adapter_check check(adapter in ('hit-v1','academic-v1'));
alter table public.calendar_sources drop constraint calendar_sources_page_url_check;
alter table public.calendar_sources add constraint calendar_sources_page_url_check check(page_url ~ '^https://([a-zA-Z0-9-]+\.)+ac\.il(/|$)');

create function public.add_calendar_institution(p_name text,p_url text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inst uuid; source uuid;
begin
  if not public.is_app_admin() then raise exception 'Administrator required'; end if;
  insert into public.institutions(name,slug) values(trim(p_name),'institution-'||gen_random_uuid()::text) returning id into inst;
  insert into public.calendar_sources(institution_id,page_url,adapter,enabled,auto_publish_new_years)
    values(inst,trim(p_url),'academic-v1',true,true) returning id into source;
  return inst;
end $$;
create function public.delete_calendar_institution(p_institution_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'Administrator required'; end if;
  perform 1 from public.institutions where id=p_institution_id for update;
  perform 1 from public.calendar_sources where institution_id=p_institution_id for update;
  if exists(select 1 from public.calendar_sources where institution_id=p_institution_id and lease_until>now()) then
    raise exception 'המוסד מתעדכן כרגע. נסו למחוק לאחר סיום הסנכרון.';
  end if;
  -- Preserve personal calendars, courses, attendance and notes.
  update public.academic_years set institution_id=null,calendar_id=null,calendar_revision=null,date_mode='manual' where institution_id=p_institution_id;
  update public.student_profiles set institution_id=null where institution_id=p_institution_id;
  delete from public.calendar_sync_runs where source_id in(select id from public.calendar_sources where institution_id=p_institution_id);
  delete from public.calendar_sources where institution_id=p_institution_id;
  delete from public.institution_calendars where institution_id=p_institution_id;
  delete from public.institutions where id=p_institution_id;
end $$;
create function public.export_my_courses() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('format','CourseTrack','version',1,'exported_at',now(),
    'attendance_labels',jsonb_build_object('attended','נכחתי','missed','לא נכחתי','pending','ממתין','null','לא סומן'),
    'academic_years',coalesce((select jsonb_agg(to_jsonb(y) order by y.id) from public.academic_years y where y.user_id=auth.uid()),'[]'::jsonb),
    'courses',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('sessions',coalesce(
      (select jsonb_agg(to_jsonb(s) order by s.id) from public.sessions s where s.course_id=c.id),'[]'::jsonb)) order by c.id)
      from public.courses c where c.user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.add_calendar_institution(text,text),public.delete_calendar_institution(uuid),public.export_my_courses() from public;
grant execute on function public.add_calendar_institution(text,text),public.delete_calendar_institution(uuid),public.export_my_courses() to authenticated;
commit;
