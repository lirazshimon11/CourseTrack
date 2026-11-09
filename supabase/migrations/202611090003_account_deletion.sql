-- Account deletion cascades through every user-owned record.
-- Existing NULL owners are left unclaimed and are not deleted with any account.
begin;

alter table public.academic_years
  drop constraint if exists academic_years_user_id_fkey,
  add constraint academic_years_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.courses
  drop constraint if exists courses_user_id_fkey,
  add constraint courses_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

commit;
