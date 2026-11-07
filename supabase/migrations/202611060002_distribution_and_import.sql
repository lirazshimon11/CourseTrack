-- Run after 202611060001_institution_calendars.sql in Supabase SQL Editor.
begin;

create table public.calendar_health(id boolean primary key default true check(id),result jsonb not null);
alter table public.calendar_health enable row level security;
revoke all on public.calendar_health from public,anon,authenticated;
grant select on public.calendar_health to authenticated;
grant all on public.calendar_health to service_role;
create policy calendar_health_admin on public.calendar_health for select to authenticated using(public.is_app_admin());

-- Internal only. Never accepts a user id from an authenticated RPC caller.
create function public.distribute_calendars_for_student(p_user uuid,p_institution uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
  insert into public.academic_years(user_id,institution_id,calendar_id,calendar_revision,date_mode,label,
    semester_a_start,semester_a_end,semester_b_start,semester_b_end,semester_c_start,semester_c_end,excluded_dates)
  select p_user,c.institution_id,c.id,c.revision,'calendar',c.label,c.semester_a_start,c.semester_a_end,
    c.semester_b_start,c.semester_b_end,c.semester_c_start,c.semester_c_end,c.excluded_dates
  from public.institution_calendars c where c.institution_id=p_institution
  on conflict(user_id,calendar_id) where calendar_id is not null do update set
    label=excluded.label,calendar_revision=excluded.calendar_revision,
    semester_a_start=excluded.semester_a_start,semester_a_end=excluded.semester_a_end,
    semester_b_start=excluded.semester_b_start,semester_b_end=excluded.semester_b_end,
    semester_c_start=excluded.semester_c_start,semester_c_end=excluded.semester_c_end,excluded_dates=excluded.excluded_dates
  where public.academic_years.date_mode='calendar' and public.academic_years.calendar_revision is distinct from excluded.calendar_revision;
  select y.id into chosen from public.academic_years y join public.institution_calendars c on c.id=y.calendar_id
    where y.user_id=p_user and c.institution_id=p_institution
    order by (coalesce(c.semester_a_start,c.semester_b_start,c.semester_c_start)<=current_date) desc,c.start_year desc limit 1;
  return chosen;
end $$;
revoke all on function public.distribute_calendars_for_student(uuid,uuid) from public,anon,authenticated;

create function public.student_calendar_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
  if new.institution_id is not null then
    chosen:=public.distribute_calendars_for_student(new.user_id,new.institution_id);
    if new.active_academic_year_id is null then
      update public.student_profiles set active_academic_year_id=chosen where user_id=new.user_id;
    elsif TG_OP='UPDATE' and new.institution_id is distinct from old.institution_id
      and new.active_academic_year_id is not distinct from old.active_academic_year_id then
      update public.student_profiles set active_academic_year_id=chosen where user_id=new.user_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.student_calendar_assignment() from public,anon,authenticated;
create trigger student_calendar_assignment after insert or update of institution_id on public.student_profiles
  for each row execute function public.student_calendar_assignment();

create function public.publish_calendar_to_students() returns trigger
language plpgsql security definer set search_path='' as $$
declare student record; chosen uuid;
begin
  for student in select user_id,active_academic_year_id from public.student_profiles where institution_id=new.institution_id order by user_id loop
    chosen:=public.distribute_calendars_for_student(student.user_id,new.institution_id);
    if student.active_academic_year_id is null then
      update public.student_profiles set active_academic_year_id=chosen where user_id=student.user_id and active_academic_year_id is null;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.publish_calendar_to_students() from public,anon,authenticated;
create trigger publish_calendar_to_students after insert or update on public.institution_calendars
  for each row execute function public.publish_calendar_to_students();
-- Backfill only institution-linked users. Unclaimed/legacy years remain untouched.
update public.student_profiles set institution_id=institution_id where institution_id is not null;

alter table public.courses add column import_key text, add column course_code text,
  add column credits numeric, add column weekly_hours numeric;
create unique index courses_import_identity on public.courses(user_id,academic_year_id,semester,import_key) where import_key is not null;

-- One transaction for a whole import. RLS remains active; no service key is used.
-- Re-importing a course skips it, preserving attendance, notes and manual edits.
create function public.import_semester(p_year uuid,p_semester text,p_courses jsonb,p_profile jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare y public.academic_years; item jsonb; slot jsonb; c public.courses; sess public.sessions;
  first_day date; last_day date; d date; v_course_id uuid; added integer:=0; skipped integer:=0; next_order integer; n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into strict y from public.academic_years where id=p_year and user_id=auth.uid() for update;
  if p_semester='א' then first_day:=y.semester_a_start;last_day:=y.semester_a_end;
  elsif p_semester='ב' then first_day:=y.semester_b_start;last_day:=y.semester_b_end;
  elsif p_semester in ('ג','קיץ') then first_day:=y.semester_c_start;last_day:=y.semester_c_end;
  else raise exception 'Invalid semester'; end if;
  if first_day is null or last_day is null or last_day<first_day or last_day-first_day>220 then raise exception 'Set valid semester dates first'; end if;
  if jsonb_typeof(p_courses) is distinct from 'array' or jsonb_array_length(p_courses) not between 1 and 60 then raise exception 'Invalid courses'; end if;
  select coalesce(max(order_index),-1)+1 into next_order from public.courses where academic_year_id=p_year;
  for item in select value from jsonb_array_elements(p_courses) loop
    select * into c from jsonb_populate_record(null::public.courses,item||jsonb_build_object('semester',p_semester));
    if c.import_key is null or length(c.import_key)>250 or coalesce(length(trim(c.name)),0) not between 1 and 200
      or jsonb_typeof(c.slots_data) is distinct from 'array' or jsonb_array_length(c.slots_data) not between 1 and 20 then raise exception 'Invalid course'; end if;
    if exists(select 1 from public.courses where user_id=auth.uid() and academic_year_id=p_year and semester=c.semester and import_key=c.import_key) then skipped:=skipped+1;continue;end if;
    insert into public.courses(name,semester,color,order_index,academic_year_id,slots_data,import_key,course_code,credits,weekly_hours)
      values(c.name,c.semester,'#7C3AED',next_order,p_year,c.slots_data,c.import_key,c.course_code,c.credits,c.weekly_hours) returning id into v_course_id;
    next_order:=next_order+1;n:=0;
    for slot in select value from jsonb_array_elements(c.slots_data) loop
      if coalesce(slot->>'type','') not in ('lecture','exercise') or coalesce(slot->>'day_of_week','') !~ '^[0-6]$'
        or coalesce(slot->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(slot->>'end_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or slot->>'end_time'<=slot->>'start_time' then raise exception 'Invalid meeting time'; end if;
      for d in select first_day+i from generate_series(0,last_day-first_day) i
        where extract(dow from first_day+i)=(slot->>'day_of_week')::int and not(first_day+i=any(y.excluded_dates)) loop
        select * into sess from jsonb_populate_record(null::public.sessions,slot||jsonb_build_object('date',d));
        insert into public.sessions(course_id,type,date,start_time,end_time,week_number,session_number,attendance,notes)
          values(v_course_id,sess.type,d,sess.start_time,sess.end_time,((d-first_day)/7)+1,1,null,'');n:=n+1;
      end loop;
    end loop;
    if n=0 then raise exception 'No meetings in semester'; end if;
    with numbered as (select id,row_number() over(partition by type order by date,start_time,id) as num from public.sessions where public.sessions.course_id=v_course_id)
      update public.sessions s set session_number=numbered.num from numbered where s.id=numbered.id;
    added:=added+1;
  end loop;
  insert into public.student_profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.student_profiles set
    track=coalesce(nullif(left(p_profile->>'track',200),''),track),degree=coalesce(nullif(left(p_profile->>'degree',200),''),degree),
    specialization=coalesce(nullif(left(p_profile->>'specialization',200),''),specialization),student_status=coalesce(nullif(left(p_profile->>'student_status',200),''),student_status),
    goal=coalesce(nullif(left(p_profile->>'goal',200),''),goal),english_level=coalesce(nullif(left(p_profile->>'english_level',200),''),english_level),
    study_year=coalesce(nullif(left(p_profile->>'study_year',200),''),study_year)
    where user_id=auth.uid();
  return jsonb_build_object('added',added,'skipped',skipped);
end $$;
revoke all on function public.import_semester(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.import_semester(uuid,text,jsonb,jsonb) to authenticated;
commit;
