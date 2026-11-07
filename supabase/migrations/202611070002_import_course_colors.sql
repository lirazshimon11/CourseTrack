-- Preserve the selected course color during atomic semester import.
-- Existing courses and their colors are not modified. Safe to rerun.
begin;
create or replace function public.import_semester(p_year uuid,p_semester text,p_courses jsonb,p_profile jsonb default '{}') returns jsonb
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
    if c.color is not null and c.color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid course color'; end if;
    if exists(select 1 from public.courses where user_id=auth.uid() and academic_year_id=p_year and semester=c.semester and import_key=c.import_key) then skipped:=skipped+1;continue;end if;
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
