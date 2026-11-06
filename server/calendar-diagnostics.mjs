// Called only after the caller has passed Supabase Auth and the administrator check.
// Never returns credentials, identities, database rows, or upstream error messages.
export async function calendarDiagnostics({ db, cronSecret }) {
  const checks = [
    { id:'auth',status:'pass',label:'כתובת Supabase והמפתח הציבורי',detail:'השרת הצליח לאמת את החשבון המחובר מול Supabase.' },
    { id:'admin',status:'pass',label:'הרשאת מנהל',detail:'החשבון המחובר אומת כמנהל בפרויקט.' },
  ];
  if (!db) {
    checks.push({id:'server_key',status:'fail',label:'המפתח הסודי של השרת',detail:'SUPABASE_SERVICE_ROLE_KEY אינו מוגדר בשרת.'});
  } else {
    try {
      // app_admins is explicitly inaccessible to anon/authenticated. This distinguishes
      // a valid server credential from accidentally supplying a publishable key.
      const privileged=await db.from('app_admins').select('user_id').limit(1);
      if(privileged.error) throw new Error('privileged-access-failed');
      checks.push({id:'server_key',status:'pass',label:'המפתח הסודי של השרת',detail:'המפתח מאפשר גישה לטבלת הרשאות שמוגנת מפני מפתחות ציבוריים.'});
      const results=await Promise.all(['calendar_sources','institution_calendars','calendar_sync_runs','institutions'].map(table=>db.from(table).select('id').limit(1)));
      checks.push(results.some(r=>r.error)
        ? {id:'schema',status:'fail',label:'טבלאות הסנכרון',detail:'לא ניתן לקרוא את כל טבלאות הסנכרון. בדקו שהמיגרציה החדשה הותקנה במלואה.'}
        : {id:'schema',status:'pass',label:'טבלאות הסנכרון',detail:'טבלאות המוסדות, הלוחות, המקורות והיומן נגישות לשרת.'});
    } catch {
      checks.push({id:'server_key',status:'fail',label:'המפתח הסודי של השרת',detail:'לא ניתן לאמת גישה ניהולית. בדקו שהמפתח סודי, שייך לאותו פרויקט ושהחיבור זמין.'});
    }
  }
  checks.push(cronSecret && cronSecret.length>=16
    ? {id:'cron_config',status:'pass',label:'הגדרת CRON_SECRET',detail:'סוד תזמון מוגדר ובאורך מתאים. זו אינה בדיקה של הפעלה מתוזמנת בפועל.'}
    : {id:'cron_config',status:'fail',label:'הגדרת CRON_SECRET',detail:'סוד התזמון חסר או קצר מ־16 תווים.'});
  return { ok:checks.every(c=>c.status==='pass'),checks,checked_at:new Date().toISOString(),
    scope:'בדיקת קריאה והרשאות בלבד. לא נשלחה בקשה ל־HIT, לא שונו נתונים ולא הופעל התזמון.' };
}
