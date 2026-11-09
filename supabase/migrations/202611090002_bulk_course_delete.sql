begin;
create or replace function public.delete_my_courses(p_course_ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(array_length(p_course_ids, 1), 0) = 0 then raise exception 'Choose at least one course'; end if;
  -- Only the caller's courses are eligible; sessions, attendance and notes are deleted with them.
  delete from public.sessions where course_id in (
    select id from public.courses where user_id=auth.uid() and id=any(p_course_ids)
  );
  delete from public.courses where user_id=auth.uid() and id=any(p_course_ids);
end $$;
revoke all on function public.delete_my_courses(uuid[]) from public,anon;
grant execute on function public.delete_my_courses(uuid[]) to authenticated;
commit;
