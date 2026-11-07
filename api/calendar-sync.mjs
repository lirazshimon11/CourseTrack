import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { syncSource } from '../server/calendar-sync.mjs';
import { calendarDiagnostics } from '../server/calendar-diagnostics.mjs';

export function matchesSecret(header, secret) {
  if (!secret || typeof header !== 'string') return false;
  const a=Buffer.from(header), b=Buffer.from(`Bearer ${secret}`);
  return a.length===b.length && timingSafeEqual(a,b);
}

export function createCalendarHandler({ clientFactory = createClient, getEnv = () => process.env, runSync = syncSource } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error:'Method not allowed' });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET } = getEnv();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
    return res.status(503).json({ error:'חסרות הגדרות שרת לסנכרון. ראו את מדריך ההתקנה.' });
  try {
    const diagnostics = req.method === 'POST' && req.body?.action === 'diagnostics';
    const cron = matchesSecret(req.headers.authorization,CRON_SECRET);
    if (!cron || diagnostics) {
      if (req.method !== 'POST') return res.status(401).json({ error:'Authentication required' });
      const token = req.headers.authorization?.replace(/^Bearer /,'');
      if (!token) return res.status(401).json({ error:'Authentication required' });
      const userDb = clientFactory(SUPABASE_URL,SUPABASE_ANON_KEY,{ global:{headers:{Authorization:`Bearer ${token}`}}, auth:{persistSession:false,autoRefreshToken:false} });
      const { data, error } = await userDb.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error:'Authentication required' });
      const role = await userDb.rpc('is_app_admin');
      if (role.error || role.data !== true) return res.status(403).json({ error:'Administrator required' });
    }
    const db = SUPABASE_SERVICE_ROLE_KEY ? clientFactory(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
    if (diagnostics) return res.status(200).json({ diagnostics:await calendarDiagnostics({db,cronSecret:CRON_SECRET}) });
    if (!db || !CRON_SECRET) return res.status(503).json({ error:'חסרות הגדרות שרת לסנכרון. הפעילו בדיקת חיבור והרשאות.' });
    const warnings=[];
    if (cron) {
      const health=await calendarDiagnostics({db,cronSecret:CRON_SECRET,scheduled:true});
      const saved=await db.from('calendar_health').upsert({id:true,result:health});
      if(!health.ok) return res.status(503).json({error:'בדיקת השרת האוטומטית נכשלה. יש לבדוק את החיבור ואת עדכון מסד הנתונים.'});
      // A missing diagnostics table must not prevent an otherwise valid calendar fetch.
      if(saved.error)warnings.push('לא ניתן לשמור את בדיקת החיבור בטבלת calendar_health. בדקו את עדכון מסד הנתונים.');
    }
    let query = db.from('calendar_sources').select('*').eq('enabled',true).order('last_checked_at',{ascending:true,nullsFirst:true});
    if (!cron) {
      const id = req.body?.source_id;
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({error:'מקור חסר או לא תקין'});
      query = query.eq('id',id);
    }
    const { data:sources,error } = await query;
    if (error) throw error;
    // Daily dispatch, but a source is due only on every second calendar day.
    // UTC day buckets avoid execution jitter pushing the next run to day three.
    const due = sources.filter(source => !cron || !source.last_checked_at ||
      Math.floor(Date.now()/86400000)-Math.floor(new Date(source.last_checked_at).getTime()/86400000)>=2);
    const results=await Promise.all(due.map(async source => {
      if (source.last_checked_at && Date.now()-new Date(source.last_checked_at).getTime()<10*60*1000) {
        return {status:'skipped',message:'בוצעה בדיקה לאחרונה. אפשר לנסות שוב לאחר עשר דקות.'};
      }
      return runSync(db,source);
    }));
    return res.status(results.some(r=>r.status==='failed') ? 502 : 200).json({ results, ...(warnings.length?{warnings}:{}) });
  } catch { return res.status(500).json({ error:'הסנכרון נכשל. בדקו את הגדרות השרת ואת טבלת הריצות.' }); }
};
}

export default createCalendarHandler();
