-- A course may have sessions. Removing its owner must remove them as well.
begin;

do $$
declare existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.sessions'::regclass
    and contype = 'f'
    and confrelid = 'public.courses'::regclass
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.sessions'::regclass and attname = 'course_id')];

  if existing_constraint is not null then
    execute format('alter table public.sessions drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.sessions
  add constraint sessions_course_id_fkey foreign key (course_id) references public.courses(id) on delete cascade;

commit;
