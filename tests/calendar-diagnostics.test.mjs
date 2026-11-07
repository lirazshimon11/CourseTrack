import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCalendarHandler } from '../api/calendar-sync.mjs';

const settings={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-test-key',SUPABASE_SERVICE_ROLE_KEY:'server-test-secret',CRON_SECRET:'cron-secret-for-testing-only'};
function setup({isAdmin=true,privileged=true,schema=true,env=settings}={}) {
  const reads=[];let syncCalls=0;
  const clientFactory=(_url,key)=>{
    if(key===settings.SUPABASE_ANON_KEY) return {
      auth:{getUser:async token=>token==='admin-token'?{data:{user:{id:'test-user'}},error:null}:{data:{user:null},error:{message:'unauthorized'}}},
      rpc:async name=>{assert.equal(name,'is_app_admin');return {data:isAdmin,error:null};},
    };
    assert.equal(key,settings.SUPABASE_SERVICE_ROLE_KEY);
    return {from:table=>({select:()=>({limit:async()=>{
      reads.push(table);
      return {data:[{user_id:'private-id'}],error:table==='app_admins'?!privileged&&{message:settings.SUPABASE_SERVICE_ROLE_KEY}:!schema&&{message:'raw database details'}};
    }})})};
  };
  const handler=createCalendarHandler({clientFactory,getEnv:()=>env,runSync:async()=>{syncCalls++;throw new Error('Must not sync during diagnostics');}});
  const run=async (token='admin-token',body={action:'diagnostics'})=>{
    const res={code:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
    await handler({method:'POST',headers:{authorization:token?`Bearer ${token}`:undefined},body},res);return res;
  };
  return {run,reads,getSyncCalls:()=>syncCalls};
}
test('admin diagnostic checks privileged server access without calling HIT or exposing secrets',async()=>{
  const {run,reads,getSyncCalls}=setup(); const res=await run();
  assert.equal(res.code,200);assert.equal(res.body.diagnostics.ok,true);assert.equal(res.body.diagnostics.checks.length,5);
  assert.equal(getSyncCalls(),0);assert.equal(res.headers['Cache-Control'],'no-store');
  assert.deepEqual(reads,['app_admins','calendar_sources','institution_calendars','calendar_sync_runs','institutions']);
  for(const value of [...Object.values(settings),'private-id','admin-token']) assert.ok(!JSON.stringify(res.body).includes(value));
});
test('anonymous, invalid-token and non-admin callers cannot inspect server configuration',async()=>{
  for(const token of ['', 'bad-token',settings.CRON_SECRET]){
    const s=setup();assert.equal((await s.run(token)).code,401);assert.deepEqual(s.reads,[]);
  }
  const regular=setup({isAdmin:false});assert.equal((await regular.run()).code,403);assert.deepEqual(regular.reads,[]);
});
test('wrong server credentials, missing secrets and schema problems produce specific safe failures',async()=>{
  const badKey=await setup({privileged:false}).run();
  assert.equal(badKey.body.diagnostics.ok,false);
  assert.equal(badKey.body.diagnostics.checks.find(c=>c.id==='server_key').status,'fail');
  assert.ok(!JSON.stringify(badKey.body).includes(settings.SUPABASE_SERVICE_ROLE_KEY));
  const missing=await setup({env:{...settings,SUPABASE_SERVICE_ROLE_KEY:'',CRON_SECRET:''}}).run();
  assert.equal(missing.body.diagnostics.checks.filter(c=>c.status==='fail').length,2);
  const schema=await setup({schema:false}).run();
  assert.equal(schema.body.diagnostics.checks.find(c=>c.id==='schema').status,'fail');
  assert.ok(!JSON.stringify(schema.body).includes('raw database details'));
});

test('scheduled runs persist only safe server health and do not claim an interactive admin login',async()=>{
  let saved;
  const db={from(table){
    const chain={select:()=>chain,limit:()=>chain,eq:()=>chain,order:()=>chain,
      then:fn=>Promise.resolve({data:[],error:null}).then(fn),
      upsert:async value=>{assert.equal(table,'calendar_health');saved=value;return {error:null};}};
    return chain;
  }};
  const handler=createCalendarHandler({clientFactory:()=>db,getEnv:()=>settings});
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
  await handler({method:'GET',headers:{authorization:`Bearer ${settings.CRON_SECRET}`}},res);
  assert.equal(res.code,200);assert.equal(saved.result.ok,true);
  assert.equal(saved.result.checks[0].id,'schedule');
  assert.ok(!saved.result.checks.some(c=>c.id==='auth'||c.id==='admin'));
  assert.ok(!JSON.stringify(saved).includes(settings.SUPABASE_SERVICE_ROLE_KEY));
});

test('health-log write failure does not block a valid source sync',async()=>{
 let calls=0;
 const db={from(table){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,
  then:fn=>Promise.resolve({data:table==='calendar_sources'?[{id:'source',last_checked_at:null}]:[],error:null}).then(fn),
  upsert:async()=>({error:{code:'42P01'}})};return q;}};
 const handler=createCalendarHandler({clientFactory:()=>db,getEnv:()=>settings,runSync:async()=>{calls++;return {status:'published'};}});
 const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
 await handler({method:'GET',headers:{authorization:`Bearer ${settings.CRON_SECRET}`}},res);
 assert.equal(calls,1);assert.equal(res.code,200);assert.equal(res.body.warnings.length,1);
});

test('scheduled dispatch checks every due source every two days, across month boundaries',async()=>{
 const originalNow=Date.now; Date.now=()=>Date.parse('2027-03-01T05:00:00Z');
 try {
  const sources=[{id:'due1',last_checked_at:'2027-02-27T05:00:03Z'},{id:'due2',last_checked_at:'2027-02-26T05:00:00Z'},{id:'new',last_checked_at:null},{id:'recent',last_checked_at:'2027-02-28T05:00:00Z'}];
  const calls=[];
  const db={from(table){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,then:fn=>Promise.resolve({data:table==='calendar_sources'?sources:[],error:null}).then(fn),upsert:async()=>({error:null})};return q;}};
  const handler=createCalendarHandler({clientFactory:()=>db,getEnv:()=>settings,runSync:async(_,source)=>{calls.push(source.id);return {status:'unchanged'};}});
  const res={setHeader(){},status(){return this;},json(v){this.body=v;return this;}};
  await handler({method:'GET',headers:{authorization:`Bearer ${settings.CRON_SECRET}`}},res);
  assert.deepEqual(calls.sort(),['due1','due2','new']);
 } finally {Date.now=originalNow;}
});
