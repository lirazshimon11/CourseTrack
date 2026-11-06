-- Replace the placeholder with your own confirmed UUID from Authentication > Users.
-- Run only in Supabase SQL Editor as the project owner, after both migrations.
insert into public.app_admins (user_id)
values ('YOUR_USER_UUID'::uuid)
on conflict do nothing;
