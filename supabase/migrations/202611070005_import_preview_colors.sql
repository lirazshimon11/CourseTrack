-- Import contract v3: persist preview colors, including automatic defaults.
-- Standalone replacement of the import function; safe to rerun.
begin;
create or replace function public.import_semester(p_year uuid,p_semester text,p_courses jsonb,p_profile jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare y public.academic_years; item jsonb; slot jsonb; c public.courses; sess public.sessions;
  first_day date; last_day date; d date; v_course_id uuid; added integer:=0; skipped integer:=0; updated integer:=0; existing public.courses; merged_slots jsonb; next_order integer; n integer;
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
    if c.color is not null and c.color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid course color'; end if;
    -- Validate before either inserting or applying an update.
    for slot in select value from jsonb_array_elements(c.slots_data) loop
      if coalesce(slot->>'type','') not in ('lecture','exercise') or coalesce(slot->>'day_of_week','') !~ '^[0-6]$'
        or coalesce(slot->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(slot->>'end_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or slot->>'end_time'<=slot->>'start_time' then raise exception 'Invalid meeting time'; end if;
    end loop;
    select * into existing from public.courses where user_id=auth.uid() and academic_year_id=p_year and semester=c.semester and import_key=c.import_key for update;
    if found then
      -- Color is part of the confirmed preview, not an optional manual edit.
      -- Compare values so unchanged imports remain idempotent.
      if not (
        (c.color is not null and lower(c.color) is distinct from lower(existing.color))
        or (coalesce(item->'edited_fields','[]'::jsonb) ? 'name' and c.name is distinct from existing.name)
        or (coalesce(item->'edited_fields','[]'::jsonb) ? 'slots_data')
      ) then
        skipped:=skipped+1; continue;
      end if;
      if item->'edited_fields' ? 'slots_data' then
        select jsonb_agg(o.value || coalesce((select jsonb_object_agg(e.key,e.value)
          from jsonb_each(c.slots_data->(o.ordinality::int-1)) e
          where item->'edited_fields' ? ('slot:'||(o.ordinality-1)::text||':'||e.key)), '{}'::jsonb) order by o.ordinality)
          into merged_slots from jsonb_array_elements(existing.slots_data) with ordinality o(value,ordinality);
        c.slots_data:=merged_slots;
        -- The preview edits slots in place. Update matching meetings in one statement,
        -- retaining IDs, attendance, notes, and individually rescheduled meetings.
        update public.sessions s set date=s.date + ((c.slots_data->(o.ordinality::int-1)->>'day_of_week')::int - (o.value->>'day_of_week')::int),
          type=c.slots_data->(o.ordinality::int-1)->>'type',
          start_time=(c.slots_data->(o.ordinality::int-1)->>'start_time')::time,
          end_time=(c.slots_data->(o.ordinality::int-1)->>'end_time')::time
        from jsonb_array_elements(existing.slots_data) with ordinality o(value,ordinality)
        where s.course_id=existing.id and s.type=o.value->>'type'
          and extract(dow from s.date)=(o.value->>'day_of_week')::int
          and s.start_time=(o.value->>'start_time')::time and s.end_time=(o.value->>'end_time')::time
          and c.slots_data->(o.ordinality::int-1) is not null;
      end if;
      update public.courses set
        name=case when item->'edited_fields' ? 'name' then c.name else existing.name end,
        color=coalesce(c.color,existing.color),
        slots_data=case when item->'edited_fields' ? 'slots_data' then c.slots_data else existing.slots_data end
        where id=existing.id;
      updated:=updated+1; continue;
    end if;
    insert into public.courses(name,semester,color,order_index,academic_year_id,slots_data,import_key,course_code,credits,weekly_hours)
      values(c.name,c.semester,coalesce(c.color,'#7C3AED'),next_order,p_year,c.slots_data,c.import_key,c.course_code,c.credits,c.weekly_hours) returning id into v_course_id;
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
    active_academic_year_id=p_year,
    track=coalesce(nullif(left(p_profile->>'track',200),''),track),degree=coalesce(nullif(left(p_profile->>'degree',200),''),degree),
    specialization=coalesce(nullif(left(p_profile->>'specialization',200),''),specialization),student_status=coalesce(nullif(left(p_profile->>'student_status',200),''),student_status),
    goal=coalesce(nullif(left(p_profile->>'goal',200),''),goal),english_level=coalesce(nullif(left(p_profile->>'english_level',200),''),english_level),
    study_year=coalesce(nullif(left(p_profile->>'study_year',200),''),study_year)
    where user_id=auth.uid();
  return jsonb_build_object('added',added,'skipped',skipped,'updated',updated);
end $$;
revoke all on function public.import_semester(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.import_semester(uuid,text,jsonb,jsonb) to authenticated;
create or replace function public.import_semester_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 3 $$;
revoke all on function public.import_semester_capabilities() from public,anon;
grant execute on function public.import_semester_capabilities() to authenticated;
commit;
