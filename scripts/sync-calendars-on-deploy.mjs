// Production deployment initialization, independent of visitors or user accounts.
// Uses exactly the same authentication, lease, validation and persistence as daily cron.
import {pathToFileURL} from 'node:url';
import {createCalendarHandler} from '../api/calendar-sync.mjs';
export async function syncOnDeploy(env=process.env,handler=createCalendarHandler({getEnv:()=>env}),log=console.log){
  if(env.VERCEL_ENV!=='production'){log('Calendar initialization skipped outside Vercel production.');return;}
  if(!env.CRON_SECRET){log('Calendar initialization unavailable: configure CRON_SECRET. Daily cron will retry once configured.');return;}
  const res={code:200,body:null,setHeader(){},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  try{
    await handler({method:'GET',headers:{authorization:`Bearer ${env.CRON_SECRET}`}},res);
    // No credentials, raw errors, or student data are logged.
    if(res.code>=400 && res.body?.error)log(`Calendar initialization error: ${res.body.error}`);
    for(const warning of res.body?.warnings??[])log(`Calendar initialization warning: ${warning}`);
    log(res.code<400?`Calendar initialization: ${(res.body?.results??[]).map(r=>r.status).join(', ')||'no enabled sources'}.`:'Calendar initialization failed; existing calendars retained. Check administrator diagnostics. Daily cron will retry.');
  }catch{log('Calendar initialization failed; existing calendars retained. Daily cron will retry.');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await syncOnDeploy();
