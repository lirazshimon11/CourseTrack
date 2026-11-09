import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('semester completion retains only notes, isolates owners and is atomic and repeatable', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub',true)::uuid $$;
      grant usage on schema auth,public to authenticated;
      create table academic_years(id uuid primary key default gen_random_uuid(),label text,semester_a_end date,semester_b_end date,semester_c_end date);
      create table courses(id uuid primary key default gen_random_uuid(),name text,semester text,academic_year_id uuid references academic_years);
      create table sessions(id uuid primary key default gen_random_uuid(),course_id uuid references courses,type text,session_number int,date date,notes text);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    for (const file of ['202611050001_accounts.sql','202611090001_semester_history.sql','202611090002_bulk_course_delete.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/'+file, import.meta.url),'utf8'));
    }
    const user = n => `00000000-0000-0000-0000-00000000000${n}`;
    const as = (n, fn) => db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user(n)]);
      return fn(tx);
    });
    const year = (await as(1, tx => tx.query("insert into academic_years(label,semester_a_end,semester_b_end) values('2025–2026','2026-01-01','2099-01-01') returning id"))).rows[0].id;
    const add = async (name, semester, notes) => {
      const id = (await as(1, tx => tx.query('insert into courses(name,semester,academic_year_id) values($1,$2,$3) returning id',[name,semester,year]))).rows[0].id;
      for (let i=0;i<notes.length;i++) await as(1, tx => tx.query("insert into sessions(course_id,type,session_number,date,notes) values($1,'lecture',$2,'2025-12-01',$3)",[id,i+1,notes[i]]));
      return id;
    };
    await add('Algebra','א',['first',' \n\t ','fifth']);
    await add('Empty','א',['',null]);
    await add('Future','ב',['keep active']);
    assert.equal((await as(1,tx=>tx.query('select * from ended_semesters()'))).rows.length,1);
    await assert.rejects(as(2,tx=>tx.query("select finish_semester($1,'א',true)",[year])));
    await assert.rejects(as(1,tx=>tx.query("select finish_semester($1,'ב',false)",[year])));
    await db.exec("create function fail_history() returns trigger language plpgsql as $$ begin raise exception 'simulated storage failure'; end $$; create trigger fail before insert on course_history for each row execute function fail_history();");
    await assert.rejects(as(1,tx=>tx.query("select finish_semester($1,'א',true)",[year])));
    assert.equal((await as(1,tx=>tx.query('select * from sessions'))).rows.length,6);
    await db.exec('drop trigger fail on course_history');
    await as(1,tx=>tx.query("select finish_semester($1,'א',true)",[year]));
    await as(1,tx=>tx.query("select finish_semester($1,'א',true)",[year]));
    const history = (await as(1,tx=>tx.query('select * from course_history'))).rows;
    assert.equal(history.length,1);
    assert.deepEqual(history[0].notes.map(n=>n.number),[1,3]);
    assert.deepEqual(Object.keys(history[0].notes[0]).sort(),['date','notes','number','type']);
    assert.equal((await as(2,tx=>tx.query('select * from course_history'))).rows.length,0);
    assert.equal((await as(1,tx=>tx.query('select * from courses'))).rows.length,1);
    await add('Discard','א',['delete me']);
    await as(1,tx=>tx.query("select finish_semester($1,'א',false)",[year]));
    assert.equal((await as(1,tx=>tx.query('select * from course_history'))).rows.length,1);
    assert.equal((await as(1,tx=>tx.query('select * from sessions'))).rows[0].notes,'keep active');
    assert.equal((await as(1,tx=>tx.query('select export_my_courses() as data'))).rows[0].data.history.length,1);
    const protectedCourse = (await as(1,tx=>tx.query("select id from courses where name='Future'"))).rows[0].id;
    await as(2,tx=>tx.query('select delete_my_courses(array[$1]::uuid[])',[protectedCourse]));
    assert.equal((await as(1,tx=>tx.query('select * from courses where id=$1',[protectedCourse]))).rows.length,1);
    await as(1,tx=>tx.query('select delete_my_courses(array[$1]::uuid[])',[protectedCourse]));
    assert.equal((await as(1,tx=>tx.query('select * from sessions'))).rows.length,0);
    await as(2,tx=>tx.query('select delete_my_course_data()'));
    assert.equal((await as(1,tx=>tx.query('select * from course_history'))).rows.length,1);
    await as(1,tx=>tx.query('select delete_my_course_data()'));
    assert.equal((await as(1,tx=>tx.query('select * from course_history'))).rows.length,0);
    assert.equal((await as(1,tx=>tx.query('select * from sessions'))).rows.length,0);
  } finally { await db.close(); }
});
