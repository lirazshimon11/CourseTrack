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
