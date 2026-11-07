import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncSource} from '../server/calendar-sync.mjs';
import {syncOnDeploy} from '../scripts/sync-calendars-on-deploy.mjs';
function memoryDb(){
 const state={institution_calendars:[],calendar_sync_runs:[],calendar_sources:[],institutions:[{slug:'hit',id:'hit'}]};
 return {state,rpc:async()=>({data:true,error:null}),from(table){
  assert.ok(table in state,'No dependency on users or profiles');
  let op='select',payload,filters=[],single=false;
  const run=()=>{let rows=state[table].filter(r=>filters.every(f=>f(r)));
   if(op==='insert'){const r={id:String(state[table].length+1),revision:1,...payload};state[table].push(r);rows=[r];}
   if(op==='update')for(const r of rows)Object.assign(r,payload,{revision:(r.revision??0)+1});
   if(op==='delete')state[table]=state[table].filter(r=>!rows.includes(r));
   return {data:single?(rows[0]??null):rows,error:null};};
  const q={select(){return q;},eq(k,v){filters.push(r=>k==='candidate->>start_year'?String(r.candidate?.start_year)===v:r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},lt(k,v){filters.push(r=>r[k]<v);return q;},order(){return q;},limit(){return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},insert(v){op='insert';payload=v;return q;},update(v){op='update';payload=v;return q;},delete(){op='delete';return q;},then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}};
  return q;
 }};
}
test('initial fetch, changed dates, next year and failure retention work without students',async()=>{
 const db=memoryDb();const src={id:'source',institution_id:'hit',auto_publish_new_years:true};
 let content={calendar:{start_year:2029,label:'2029-2030',semester_a_start:'2029-10-20',semester_a_end:'2030-01-20',notes:'source notes'},source_url:'https://www.hit.ac.il/students/calender/',source_hash:'one',warnings:[]};
 const reader=async()=>content;
 db.state.calendar_sync_runs.push({source_id:'source',status:'review',candidate:content.calendar});
 assert.equal((await syncSource(db,src,reader)).status,'published');
 assert.equal(db.state.institution_calendars[0].semester_a_start,'2029-10-20');
 assert.equal(db.state.calendar_sync_runs[0].status,'dismissed');
 assert.equal((await syncSource(db,src,reader)).status,'unchanged');
 content={...content,source_hash:'two',calendar:{...content.calendar,semester_a_end:'2030-01-25'}};
 assert.equal((await syncSource(db,src,reader)).status,'published');
 assert.equal(db.state.institution_calendars.length,1);
 assert.equal(db.state.institution_calendars[0].semester_a_end,'2030-01-25');
 content={...content,source_hash:'three',calendar:{...content.calendar,start_year:2030,label:'2030-2031',semester_a_start:'2030-10-20',semester_a_end:'2031-01-25'}};
 assert.equal((await syncSource(db,src,reader)).status,'published');
 assert.equal(db.state.institution_calendars.length,2);
 const before=JSON.stringify(db.state.institution_calendars);
 assert.equal((await syncSource(db,src,async()=>{throw new Error('network unavailable');})).status,'failed');
 assert.equal(JSON.stringify(db.state.institution_calendars),before);
 db.state.institution_calendars[1].origin='manual';content={...content,source_hash:'four'};
 assert.equal((await syncSource(db,src,reader)).status,'unchanged');
});
test('deployment initialization runs only in production and never logs secrets',async()=>{
 let calls=0;const logs=[];const handler=async(req,res)=>{calls++;assert.equal(req.headers.authorization,'Bearer private-test');res.json({results:[{status:'published'}]});};
 await syncOnDeploy({VERCEL_ENV:'preview',CRON_SECRET:'private-test'},handler,s=>logs.push(s));assert.equal(calls,0);
 await syncOnDeploy({VERCEL_ENV:'production',CRON_SECRET:'private-test'},handler,s=>logs.push(s));assert.equal(calls,1);
 assert.ok(!logs.join('').includes('private-test'));
});
