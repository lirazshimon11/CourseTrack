import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { syncSource } from '../server/calendar-sync.mjs';

export function matchesSecret(header, secret) {
  if (!secret || typeof header !== 'string') return false;
  const a=Buffer.from(header), b=Buffer.from(`Bearer ${secret}`);
  return a.length===b.length && timingSafeEqual(a,b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error:'Method not allowed' });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !CRON_SECRET)
    return res.status(503).json({ error:'חסרות הגדרות שרת לסנכרון. ראו את מדריך ההתקנה.' });
  try {
    const cron = matchesSecret(req.headers.authorization,CRON_SECRET);
    if (!cron) {
      if (req.method !== 'POST') return res.status(401).json({ error:'Authentication required' });
      const token = req.headers.authorization?.replace(/^Bearer /,'');
      if (!token) return res.status(401).json({ error:'Authentication required' });
      const userDb = createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{ global:{headers:{Authorization:`Bearer ${token}`}}, auth:{persistSession:false,autoRefreshToken:false} });
      const { data, error } = await userDb.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error:'Authentication required' });
      const role = await userDb.rpc('is_app_admin');
      if (role.error || role.data !== true) return res.status(403).json({ error:'Administrator required' });
    }
    const db = createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    let query = db.from('calendar_sources').select('*').eq('enabled',true).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(1);
    // One bounded HIT source per run. Other institutions currently use manual calendars.
    if (!cron) {
      const id = req.body?.source_id;
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({error:'מקור חסר או לא תקין'});
      query = query.eq('id',id);
    }
    const { data:sources,error } = await query;
    if (error) throw error;
    const results=[];
    for (const source of sources) {
      if (source.last_checked_at && Date.now()-new Date(source.last_checked_at).getTime()<10*60*1000) {
        results.push({status:'skipped',message:'בוצעה בדיקה לאחרונה. אפשר לנסות שוב לאחר עשר דקות.'}); continue;
      }
      results.push(await syncSource(db,source));
    }
    return res.status(results.some(r=>r.status==='failed') ? 502 : 200).json({ results });
  } catch { return res.status(500).json({ error:'הסנכרון נכשל. בדקו את הגדרות השרת ואת טבלת הריצות.' }); }
}
