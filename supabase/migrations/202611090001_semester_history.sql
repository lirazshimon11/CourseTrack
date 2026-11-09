begin;
create table public.course_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year_label text not null,
  semester text not null,
  term_end date not null,
  course_name text not null,
  notes jsonb not null
);
alter table public.course_history enable row level security;
create index course_history_owner on public.course_history(user_id,term_end desc);
create policy own_history on public.course_history for select to authenticated using(user_id=auth.uid());
create policy delete_own_history on public.course_history for delete to authenticated using(user_id=auth.uid());
revoke all on public.course_history from anon, authenticated;
grant select, delete on public.course_history to authenticated;

create function public.ended_semesters() returns table(year_id uuid,year_label text,semester text,term_end date)
language sql stable security invoker set search_path='' as $$
  select distinct y.id,y.label,t.semester,t.term_end
  from public.academic_years y
  cross join lateral (values ('א',y.semester_a_end),('ב',y.semester_b_end),('ג',y.semester_c_end)) t(semester,term_end)
  where y.user_id=auth.uid() and t.term_end < (now() at time zone 'Asia/Jerusalem')::date
  and exists(select 1 from public.courses c where c.academic_year_id=y.id and c.user_id=auth.uid()
    and (c.semester=t.semester or (t.semester='ג' and c.semester='קיץ')))
  order by t.term_end,y.id,t.semester
$$;

create function public.finish_semester(p_year_id uuid,p_semester text,p_keep_notes boolean) returns void
language plpgsql security definer set search_path='' as $$
declare y public.academic_years; ending date; ids uuid[];
begin
  if auth.uid() is null or p_keep_notes is null then raise exception 'Authentication and decision required'; end if;
  select * into y from public.academic_years where id=p_year_id and user_id=auth.uid() for update;
  if not found then raise exception 'Year not found'; end if;
  ending := case p_semester when 'א' then y.semester_a_end when 'ב' then y.semester_b_end when 'ג' then y.semester_c_end end;
  if ending is null or ending >= (now() at time zone 'Asia/Jerusalem')::date then raise exception 'Semester has not ended'; end if;
  select array_agg(id) into ids from (select id from public.courses where user_id=auth.uid() and academic_year_id=y.id
    and (semester=p_semester or (p_semester='ג' and semester='קיץ')) for update) c;
  -- Lock notes before taking the snapshot; all writes and cleanup commit together.
  perform 1 from public.sessions where course_id=any(ids) for update;
  if p_keep_notes then
    insert into public.course_history(user_id,year_label,semester,term_end,course_name,notes)
    select auth.uid(),y.label,p_semester,ending,c.name,
      jsonb_agg(jsonb_build_object('type',s.type,'number',s.session_number,'date',s.date,'notes',s.notes) order by s.date,s.session_number,s.type)
    from public.courses c join public.sessions s on s.course_id=c.id
    where c.id=any(ids) and s.notes ~ '[^[:space:]]' group by c.id,c.name;
  end if;
  delete from public.sessions where course_id=any(ids);
  delete from public.courses where id=any(ids);
end $$;
revoke all on function public.ended_semesters(),public.finish_semester(uuid,text,boolean) from public,anon;
grant execute on function public.ended_semesters(),public.finish_semester(uuid,text,boolean) to authenticated;
create function public.delete_my_course_data() returns void
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.sessions where course_id in(select id from public.courses where user_id=auth.uid());
  delete from public.courses where user_id=auth.uid();
  delete from public.course_history where user_id=auth.uid();
end $$;
revoke all on function public.delete_my_course_data() from public,anon;
grant execute on function public.delete_my_course_data() to authenticated;
create or replace function public.export_my_courses() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('format','CourseTrack','version',2,'exported_at',now(),
    'attendance_labels',jsonb_build_object('attended','נכחתי','missed','לא נכחתי','pending','ממתין','null','לא סומן'),
    'academic_years',coalesce((select jsonb_agg(to_jsonb(y) order by y.id) from public.academic_years y where y.user_id=auth.uid()),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.term_end desc,h.id) from public.course_history h where h.user_id=auth.uid()),'[]'::jsonb),
    'courses',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('sessions',coalesce(
      (select jsonb_agg(to_jsonb(s) order by s.id) from public.sessions s where s.course_id=c.id),'[]'::jsonb)) order by c.id)
      from public.courses c where c.user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.export_my_courses() from public,anon;
grant execute on function public.export_my_courses() to authenticated;
commit;
