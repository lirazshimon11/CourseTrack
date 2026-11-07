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
    const seed=await readFile(new URL('../supabase/migrations/202611070001_hit_calendar_bootstrap.sql',import.meta.url),'utf8');
    await db.exec(seed);await db.exec(seed);
    assert.equal((await db.query('select count(*)::int as n from student_profiles')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from institution_calendars')).rows[0].n,0);
    assert.equal((await db.query('select auto_publish_new_years from calendar_sources')).rows[0].auto_publish_new_years,true);
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
    // Upgrade an existing installation, including manual overrides and courses.
    await db.exec(`alter table courses add column semester text,add column color text,add column order_index int,add column slots_data jsonb;
      alter table sessions add column type text,add column date date,add column start_time time,add column end_time time,
        add column week_number int,add column session_number int,add column attendance text;`);
    await asUser(A,tx=>tx.query("update academic_years set date_mode='manual',semester_a_end='2027-02-01' where id=$1",[yearA]));
    await db.exec(await readFile(new URL('../supabase/migrations/202611060002_distribution_and_import.sql',import.meta.url),'utf8'));
    assert.equal((await db.query('select semester_a_end::text as d from academic_years where id=$1',[yearA])).rows[0].d,'2027-02-01');
    assert.equal((await db.query('select semester_a_end::text as d from academic_years where id=$1',[yearB])).rows[0].d,'2027-01-30');
    await assert.rejects(asUser(A,tx=>tx.query('select distribute_calendars_for_student($1,$2)',[B,hit])));
    await asUser(ADMIN,tx=>tx.query("update institution_calendars set semester_a_end='2027-01-31' where id=$1",[cal]));
    assert.equal((await db.query('select semester_a_end::text as d from academic_years where id=$1',[yearB])).rows[0].d,'2027-01-31');
    assert.equal((await db.query('select semester_a_end::text as d from academic_years where id=$1',[yearA])).rows[0].d,'2027-02-01');
    await asUser(B,tx=>tx.query('update student_profiles set institution_id=$1',[other]));
    const bActive=(await asUser(B,tx=>tx.query('select active_academic_year_id as id from student_profiles'))).rows[0].id;
    assert.equal((await db.query('select institution_id from academic_years where id=$1',[bActive])).rows[0].institution_id,other);
    const future=(await createCalendar(hit,2029)).rows[0].id;
    assert.equal((await db.query('select count(*)::int as n from academic_years where calendar_id=$1',[future])).rows[0].n,1);
    await asUser(A,tx=>tx.query("update academic_years set excluded_dates=ARRAY['2026-12-06'::date] where id=$1",[yearA]));
    await db.query("insert into calendar_health(id,result) values(true,'{\"ok\":true}')");
    assert.equal((await asUser(A,tx=>tx.query('select * from calendar_health'))).rows.length,0);
    assert.equal((await asUser(ADMIN,tx=>tx.query('select * from calendar_health'))).rows.length,1);
    await assert.rejects(asUser(ADMIN,tx=>tx.query("update calendar_health set result='{}'")));
    await db.exec(await readFile(new URL('../supabase/migrations/202611070002_import_course_colors.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611070003_import_course_updates.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611070004_import_contract.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611070005_import_preview_colors.sql',import.meta.url),'utf8'));
    assert.equal((await asUser(A,tx=>tx.query('select import_semester_capabilities() as version'))).rows[0].version,3);
    const imported=[{name:'Signals',import_key:'Signals',course_code:'50060-1',color:'#EC4899',credits:3.5,weekly_hours:4,
      slots_data:[{type:'lecture',day_of_week:0,start_time:'08:00',end_time:'11:00',lecturer:'Teacher',room:'218-5'},
      {type:'exercise',day_of_week:0,start_time:'11:00',end_time:'12:00'}]}];
    const runImport=(user,year,items=imported)=>asUser(user,tx=>tx.query("select import_semester($1,'א',$2,$3) as result",[year,JSON.stringify(items),JSON.stringify({track:'Electrical engineering',study_year:'ג'})]));
    await assert.rejects(runImport(B,yearA));
    assert.deepEqual((await runImport(A,yearA)).rows[0].result,{added:1,skipped:0,updated:0});
    assert.equal((await asUser(A,tx=>tx.query('select active_academic_year_id from student_profiles where user_id=auth.uid()'))).rows[0].active_academic_year_id,yearA);
    assert.deepEqual((await runImport(A,yearA,[{...imported[0],color:'#3B82F6'}])).rows[0].result,{added:0,skipped:0,updated:1});
    assert.equal((await db.query("select color from courses where import_key='Signals'")).rows[0].color,'#3B82F6');
    assert.deepEqual((await runImport(A,yearA,[{...imported[0],color:'#3b82f6'}])).rows[0].result,{added:0,skipped:1,updated:0});
    await assert.rejects(runImport(A,yearA,[{...imported[0],import_key:'bad-color',color:'invalid'}]));
    const importedId=(await db.query("select id from courses where import_key='Signals'")).rows[0].id;
    assert.ok((await db.query('select count(*)::int as n from sessions where course_id=$1',[importedId])).rows[0].n>20);
    assert.equal((await db.query("select count(*)::int as n from sessions where course_id=$1 and date='2026-12-06'",[importedId])).rows[0].n,0);
    assert.equal((await db.query('select notes from sessions where course_id=$1',[course])).rows[0].notes,'keep this note');
    await db.query("update sessions set notes='preserve',attendance='present' where course_id=$1",[importedId]);
    const before=(await db.query('select * from sessions where course_id=$1 order by id',[importedId])).rows;
    await asUser(A,tx=>tx.query("update courses set name='Custom name' where id=$1",[importedId]));
    assert.deepEqual((await runImport(A,yearA,[{...imported[0],color:'#22C55E',edited_fields:['color']}])).rows[0].result,{added:0,skipped:0,updated:1});
    assert.deepEqual((await db.query('select id,name,color from courses where id=$1',[importedId])).rows[0],{id:importedId,name:'Custom name',color:'#22C55E'});
    assert.deepEqual((await db.query('select * from sessions where course_id=$1 order by id',[importedId])).rows,before);
    // Reproduce legacy purple courses -> new automatic preview defaults with no clicks.
    await db.query("update courses set color='#7C3AED' where id=$1",[importedId]);
    assert.deepEqual((await runImport(A,yearA)).rows[0].result,{added:0,skipped:0,updated:1});
    assert.equal((await db.query('select color from courses where id=$1',[importedId])).rows[0].color,imported[0].color);
    assert.deepEqual((await db.query('select * from sessions where course_id=$1 order by id',[importedId])).rows,before);
    assert.deepEqual((await runImport(A,yearA)).rows[0].result,{added:0,skipped:1,updated:0});

    const changed={...imported[0],edited_fields:['slots_data','slot:0:start_time'],slots_data:imported[0].slots_data.map((s,i)=>i===0?{...s,start_time:'09:00'}:s)};
    await runImport(A,yearA,[changed]);
    const after=(await db.query('select * from sessions where course_id=$1 order by id',[importedId])).rows;
    assert.deepEqual(after.map(s=>({...s,start_time:before.find(b=>b.id===s.id).start_time})),before);
    assert.ok(after.filter(s=>s.type==='lecture').every(s=>s.start_time==='09:00:00'));
    const bad=[{...imported[0],name:'First',import_key:'First'},{...imported[0],name:'Invalid',import_key:'Invalid',slots_data:[{type:'lecture',day_of_week:8,start_time:'25:00',end_time:'27:00'}]}];
    await assert.rejects(runImport(A,yearA,bad));
    assert.equal((await db.query("select count(*)::int as n from courses where import_key='First'")).rows[0].n,0);
    assert.equal((await asUser(A,tx=>tx.query('select study_year from student_profiles'))).rows[0].study_year,'ג');

  } finally { await db.close(); }
});
