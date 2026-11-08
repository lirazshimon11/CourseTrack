import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { profileFields } from '../lib/calendars';
import { Action, Disclosure, ui } from './SettingsUI';

type Detail = { label: string; value: string };
const date = (value?: string) => value
  ? new Date(value).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'לא נשמר';
const stored = (value: unknown) => typeof value === 'string' && value.trim() ? value : 'לא הוגדר';

export function AccountDetails() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [details, setDetails] = useState<{ account: Detail[]; academic: Detail[]; totals: Detail[]; id: string } | null>(null);
  const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setDetails(null); setError(false);
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error || !auth.data.user) throw new Error('Authentication required');
        const user = auth.data.user;
        const count = (table: 'courses' | 'academic_years') => supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        const sessions = () => supabase.from('sessions').select('id,courses!inner(user_id)', { count: 'exact', head: true }).eq('courses.user_id', user.id);
        const [profileResult, ...counts] = await Promise.all([
          supabase.from('student_profiles').select('*').eq('user_id',user.id).maybeSingle(),
          count('academic_years'), count('courses'), sessions(),
          sessions().eq('attendance','attended'), sessions().eq('attendance','missed'),
          sessions().or('attendance.is.null,attendance.eq.pending'),
          sessions().not('notes','is',null).neq('notes',''),
        ]);
        if (profileResult.error || counts.some(result => result.error || typeof result.count !== 'number')) throw new Error('Read failed');
        const profile = profileResult.data;
        const [institution, year] = await Promise.all([
          profile?.institution_id ? supabase.from('institutions').select('name').eq('id',profile.institution_id).maybeSingle() : Promise.resolve({data:null,error:null}),
          profile?.active_academic_year_id ? supabase.from('academic_years').select('label,date_mode').eq('id',profile.active_academic_year_id).eq('user_id',user.id).maybeSingle() : Promise.resolve({data:null,error:null}),
        ]);
        if (institution.error || year.error) throw new Error('Read failed');
        const account: Detail[] = [
          {label:'אימייל',value:stored(user.email)},
          {label:'אימות אימייל',value:user.email_confirmed_at ? 'מאומת' : 'טרם אומת'},
          {label:'החשבון נוצר בתאריך',value:date(user.created_at)},
          {label:'כניסה אחרונה',value:date(user.last_sign_in_at)},
        ];
        const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
        if (typeof name === 'string' && name.trim()) account.unshift({label:'שם',value:name});
        if (user.phone) account.push({label:'טלפון',value:user.phone});
        if (active) setDetails({id:user.id,account,academic:[
          {label:'מוסד אקדמי',value:stored(institution.data?.name)},
          {label:'שנת לימודים פעילה שנשמרה',value:stored(year.data?.label)},
          {label:'מקור תאריכי השנה',value:year.data ? year.data.date_mode === 'calendar' ? 'לוח המוסד' : 'התאמה אישית' : 'לא הוגדר'},
          ...profileFields.map(([field,label])=>({label,value:stored(profile?.[field])})),
        ],totals:['שנות לימודים שמורות','קורסים','מפגשים','מפגשים שסומנו כנוכחות','מפגשים שסומנו כהיעדרות','מפגשים שטרם סומנו','מפגשים עם הערות'].map((label,index)=>({label,value:String(counts[index].count)}))});
      } catch { if (active) setError(true); }
    })();
    return () => { active=false; };
  }, [attempt]));
  if (error) return <View style={{gap:10}}><Text accessibilityRole="alert" style={ui.text}>לא ניתן לטעון את פרטי החשבון כרגע.</Text><Action secondary title="ניסיון נוסף" onPress={()=>setAttempt(value=>value+1)} /></View>;
  if (!details) return <Text style={ui.text}>טוען את הפרטים השמורים בחשבון…</Text>;
  const rows = (items: Detail[]) => items.map(item=><View key={item.label} style={{gap:2,paddingVertical:5}}><Text style={ui.text}>{item.label}</Text><Text selectable style={[ui.text,{color:'#F1F5F9'}]}>{item.value}</Text></View>);
  return <View style={{gap:14}}>
    <Text style={ui.subtitle}>פרטי החשבון</Text>
    {rows(details.account)}
    <Text style={ui.subtitle}>הפרופיל האקדמי שלי</Text>
    {rows(details.academic)}
    <Action secondary title="עריכת הפרטים האקדמיים" onPress={()=>router.push('/calendars')} />
    <Text style={ui.subtitle}>המידע השמור שלי · כל השנים</Text>
    {rows(details.totals)}
    <Text style={ui.text}>בקורסים נשמרים גם שעות המפגשים, מרצים, חדרים וצבעים, ככל שהוזנו. אפשר לעיין בנוכחות ובהערות בתוך כל קורס, או להוריד את הקובץ המלא באמצעות ייצוא הנתונים בעמוד ההגדרות.</Text>
    <Action secondary title="צפייה בקורסים שלי" onPress={()=>router.push('/')} />
    <Disclosure title="מזהה החשבון">{rows([{label:'מזהה משתמש',value:details.id}])}</Disclosure>
  </View>;
}
