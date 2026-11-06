import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migrations and real Postgres RLS: users, institutions, personal copies, admins and sync leases',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create table public.academic_years(id uuid primary key default gen_random_uuid(),label text not null,
        semester_a_start date,semester_a_end date,semester_b_start date,semester_b_end date,semester_c_start date,semester_c_end date,created_at timestamptz default now());
      create table public.courses(id uuid primary key default gen_random_uuid(),name text,academic_year_id uuid references public.academic_years(id));
      create table public.sessions(id uuid primary key default gen_random_uuid(),course_id uuid references public.courses(id),notes text);
      insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
      insert into academic_years(label) values ('legacy-unclaimed');
    `);
    for(const file of ['202611050001_accounts.sql','202611060001_institution_calendars.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    const [A,B,ADMIN]=[1,2,3].map(n=>`00000000-0000-4000-8000-00000000000${n}`);
    const asUser=(id,fn,role='authenticated')=>db.transaction(async tx=>{
      await tx.exec(`set local role ${role}`); await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']); return fn(tx);
    });
    await db.query('insert into app_admins(user_id) values($1)',[ADMIN]);
    const hit=(await db.query("select id from institutions where slug='hit'")).rows[0].id;
    assert.equal((await asUser(A,tx=>tx.query('select is_app_admin() as admin'))).rows[0].admin,false);
    await assert.rejects(asUser(A,tx=>tx.query('insert into app_admins values($1,now())',[A])));
    await assert.rejects(asUser(A,tx=>tx.query("insert into institutions(slug,name) values('evil','evil')")));
    await assert.rejects(asUser(null,tx=>tx.query('select * from institution_calendars'),'anon'));
    const other=(await asUser(ADMIN,tx=>tx.query("insert into institutions(slug,name) values('other','Other university') returning id"))).rows[0].id;
    const createCalendar=(inst,year)=>asUser(ADMIN,tx=>tx.query(`insert into institution_calendars(institution_id,start_year,label,semester_a_start,semester_a_end,excluded_dates)
      values($1,$2,$3,$4,$5,ARRAY[$6::date]) returning id`,[inst,year,`${year}-${year+1}`,`${year}-10-20`,`${year+1}-01-20`,`${year}-12-01`]));
    const cal=(await createCalendar(hit,2026)).rows[0].id;
    const next=(await createCalendar(hit,2027)).rows[0].id;
    const foreign=(await createCalendar(other,2026)).rows[0].id;
    assert.notEqual(cal,foreign);
    await assert.rejects(asUser(A,tx=>tx.query("update institution_calendars set label='hacked' returning id" )).then(r=>{if(r.rows.length===0)throw new Error('RLS denied');}));
    const adopt=(user,id)=>asUser(user,tx=>tx.query('select adopt_institution_calendar($1) as id',[id]));
    const yearA=(await adopt(A,cal)).rows[0].id;
    const yearB=(await adopt(B,cal)).rows[0].id;
    assert.notEqual(yearA,yearB);
    assert.equal((await asUser(A,tx=>tx.query('select * from academic_years'))).rows.length,1);
    assert.equal((await asUser(A,tx=>tx.query('select * from academic_years where id=$1',[yearB]))).rows.length,0);
    await assert.rejects(asUser(A,tx=>tx.query('update student_profiles set active_academic_year_id=$1',[yearB])));
    await asUser(A,tx=>tx.query("update academic_years set semester_a_end='2027-01-25',date_mode='manual' where id=$1",[yearA]));
    await asUser(ADMIN,tx=>tx.query("update institution_calendars set semester_a_end='2027-01-30' where id=$1",[cal]));
    assert.equal((await asUser(A,tx=>tx.query('select semester_a_end::text as d from academic_years'))).rows[0].d,'2027-01-25');
    const course=(await asUser(A,tx=>tx.query("insert into courses(name,academic_year_id) values('mine',$1) returning id",[yearA]))).rows[0].id;
    await asUser(A,tx=>tx.query("insert into sessions(course_id,notes) values($1,'keep this note')",[course]));
    await assert.rejects(asUser(B,tx=>tx.query("insert into sessions(course_id,notes) values($1,'cross-account')",[course])));
    await assert.rejects(asUser(B,tx=>tx.query("insert into courses(name,academic_year_id) values('cross-account',$1)",[yearA])));
    assert.equal((await adopt(A,cal)).rows[0].id,yearA);
    assert.equal((await asUser(A,tx=>tx.query('select semester_a_end::text as d from academic_years'))).rows[0].d,'2027-01-30');
    await adopt(A,next);
    assert.equal((await asUser(A,tx=>tx.query('select * from academic_years'))).rows.length,2);
    assert.equal((await asUser(A,tx=>tx.query('select notes from sessions'))).rows[0].notes,'keep this note');
    const source=(await db.query('select id from calendar_sources')).rows[0].id;
    await assert.rejects(asUser(A,tx=>tx.query('select claim_calendar_source($1)',[source])));
    assert.equal((await asUser(null,tx=>tx.query('select claim_calendar_source($1) as ok',[source]),'service_role')).rows[0].ok,true);
    assert.equal((await asUser(null,tx=>tx.query('select claim_calendar_source($1) as ok',[source]),'service_role')).rows[0].ok,false);
    const candidate={start_year:2028,label:'2028-2029',semester_a_start:'2028-10-20',semester_a_end:'2029-01-20',excluded_dates:[]};
    const run=(await db.query("insert into calendar_sync_runs(source_id,status,candidate) values($1,'review',$2) returning id",[source,JSON.stringify(candidate)])).rows[0].id;
    await assert.rejects(asUser(A,tx=>tx.query('select review_calendar_run($1,true)',[run])));
    await asUser(ADMIN,tx=>tx.query('select review_calendar_run($1,true)',[run]));
    await assert.rejects(asUser(ADMIN,tx=>tx.query('select review_calendar_run($1,true)',[run])));
    assert.equal((await db.query('select institution_id from institution_calendars where start_year=2028')).rows[0].institution_id,hit);
    assert.equal((await db.query("select user_id from academic_years where label='legacy-unclaimed'")).rows[0].user_id,null);
  } finally { await db.close(); }
});
