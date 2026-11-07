-- Configuration only: never seeds academic dates or calendar content.
-- Safe to rerun even if the earlier data-seeding version was already applied.
begin;
insert into public.institutions(slug,name) values('hit','HIT — מכון טכנולוגי חולון') on conflict(slug) do nothing;
insert into public.calendar_sources(institution_id,page_url,adapter,enabled,auto_publish_new_years)
select id,'https://www.hit.ac.il/students/calender/','hit-v1',true,true from public.institutions where slug='hit'
on conflict(institution_id) do update set auto_publish_new_years=true;
-- Existing calendars are retained until a validated source fetch replaces them.
commit;
