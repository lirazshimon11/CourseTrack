import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { CalendarRun, CalendarSource, Institution, InstitutionCalendar, StudentProfile, calendarDates, editableDates, profileFields } from '../lib/calendars';
import { AcademicYear } from '../types';
import { AcademicYearModal } from '../components/AcademicYearModal';
import { ConfirmModal } from '../components/ConfirmModal';

function Button({ title, onPress, disabled=false }: {title:string;onPress:()=>void;disabled?:boolean}) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,disabled && {opacity:0.5}]}><Text style={s.link}>{title}</Text></TouchableOpacity>;
}
const dateTime = (v:string|null) => v ? new Date(v).toLocaleString('he-IL') : 'טרם בוצעה';

export default function CalendarsScreen() {
  const router = useRouter();
  const [institutions,setInstitutions]=useState<Institution[]>([]);
  const [calendars,setCalendars]=useState<InstitutionCalendar[]>([]);
  const [years,setYears]=useState<AcademicYear[]>([]);
  const [profile,setProfile]=useState<Partial<StudentProfile>>({});
  const [selected,setSelected]=useState<string>('');
  const [admin,setAdmin]=useState(false);
  const [sources,setSources]=useState<CalendarSource[]>([]);
  const [runs,setRuns]=useState<CalendarRun[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [message,setMessage]=useState('');
  const [diagnostics,setDiagnostics]=useState<{ok:boolean;checked_at:string;scope:string;checks:{id:string;status:string;label:string;detail:string}[]}|null>(null);
  const [editor,setEditor]=useState<{mode:'personal'|'shared';current:AcademicYear|null}|null>(null);
  const [adopt,setAdopt]=useState<InstitutionCalendar|null>(null);
  const [review,setReview]=useState<CalendarRun|null>(null);
  const [newName,setNewName]=useState('');
  const [newSlug,setNewSlug]=useState('');
  const [newYear,setNewYear]=useState(String(new Date().getFullYear()));
  const [notes,setNotes]=useState('');
  const [sourceUrl,setSourceUrl]=useState('');
  const [showProfile,setShowProfile]=useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const responses = await Promise.all([
        supabase.from('institutions').select('*').order('name'),
        supabase.from('institution_calendars').select('*').order('start_year',{ascending:false}),
        supabase.from('academic_years').select('*').order('created_at',{ascending:false}),
        supabase.from('student_profiles').select('*').maybeSingle(),
        supabase.rpc('is_app_admin'),
      ]);
      for (const response of responses) if (response.error) throw response.error;
      const inst = responses[0].data as unknown as Institution[];
      const prof = responses[3].data as unknown as StudentProfile|null;
      setInstitutions(inst); setCalendars(responses[1].data as unknown as InstitutionCalendar[]);
      setYears(responses[2].data as unknown as AcademicYear[]); setProfile(prof ?? {});
      setSelected(current => current || prof?.institution_id || '');
      const isAdmin = responses[4].data === true; setAdmin(isAdmin);
      if (isAdmin) {
        const [src,logs] = await Promise.all([
          supabase.from('calendar_sources').select('*'),
          supabase.from('calendar_sync_runs').select('*').order('created_at',{ascending:false}).limit(30),
        ]);
        if (src.error) throw src.error; if (logs.error) throw logs.error;
        setSources(src.data); setRuns(logs.data);
      }
    } catch { setLoadError('לא ניתן לטעון את הלוחות. ודאו שקובץ ה־SQL החדש הופעל ושהחיבור תקין.'); }
    finally { setLoading(false); }
  },[]);
  useFocusEffect(useCallback(()=>{ void reload(); },[reload]));

  const action = async (fn:()=>Promise<void>, success:string) => {
    setBusy(true); setMessage('');
    try { await fn(); await reload(); setMessage(success); }
    catch (e:any) { setMessage(e.message || 'הפעולה נכשלה. נסו שוב.'); }
    finally { setBusy(false); }
  };
  const check = (r:{error:any}) => { if (r.error) throw r.error; };
  const saveProfile = async (extra:Partial<StudentProfile>={}) => {
    const { data:{user},error } = await supabase.auth.getUser(); if(error || !user) throw new Error('נדרשת כניסה מחדש');
    check(await supabase.from('student_profiles').upsert({ ...profile,...extra,user_id:user.id }));
  };
  const saveEditor = async (data:Omit<AcademicYear,'id'|'created_at'>) => {
    if (!editor || !selected) return {error:new Error('בחרו מוסד')};
    try {
      const fields = editableDates(data as AcademicYear);
      if (editor.mode==='shared') {
        const start = Number(newYear);
        if (!Number.isInteger(start)||start<2000||start>2200) throw new Error('שנת ההתחלה אינה תקינה');
        const shared = { ...fields,institution_id:selected,start_year:start,notes,origin:'manual',source_hash:null };
        check(editor.current ? await supabase.from('institution_calendars').update(shared).eq('id',editor.current.id) : await supabase.from('institution_calendars').insert(shared));
      } else {
        const personal = {...fields,institution_id:selected,date_mode:'manual'};
        if (editor.current) check(await supabase.from('academic_years').update(personal).eq('id',editor.current.id));
        else {
          const result = await supabase.from('academic_years').insert(personal).select('id').single(); check(result);
          await saveProfile({institution_id:selected,active_academic_year_id:result.data!.id});
        }
      }
      setMessage(editor.mode==='shared' ? 'הלוח המשותף נשמר. עותקים אישיים לא שונו.' : 'התאריכים האישיים נשמרו. מפגשים קיימים לא שונו.');
      await reload(); return {error:null};
    } catch(error) { return {error}; }
  };
  const source=sources.find(x=>x.institution_id===selected);
  const institution=institutions.find(x=>x.id===selected);
  const activeId=profile.active_academic_year_id ?? years[0]?.id;
  const active=years.find(x=>x.id===activeId);
  const currentShared=calendars.find(x=>x.id===active?.calendar_id);
  const sync = () => action(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    const response=await fetch('/api/calendar-sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token ?? ''}`},body:JSON.stringify({source_id:source?.id})});
    if (!(response.headers.get('content-type')??'').includes('application/json')) throw new Error('הרצת הסנכרון זמינה בפריסה ב־Vercel או ב־vercel dev. שרת Expo אינו מפעיל פונקציות שרת.');
    const result=await response.json();
    if (!response.ok) throw new Error(result.error ?? result.results?.[0]?.message ?? 'הסנכרון נכשל');
    if(result.results?.[0]?.status==='skipped') throw new Error(result.results[0].message);
  },'בדיקת המקור הסתיימה. התוצאה מופיעה ביומן הסנכרון.');
  const diagnose = async () => {
    setBusy(true);setMessage('');setDiagnostics(null);
    try {
      const {data:{session}}=await supabase.auth.getSession();
      const response=await fetch('/api/calendar-sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token??''}`},body:JSON.stringify({action:'diagnostics'})});
      if (!(response.headers.get('content-type')??'').includes('application/json')) throw new Error('הבדיקה זמינה בפריסה ב־Vercel או ב־vercel dev, ולא בשרת Expo.');
      const result=await response.json();
      if(!response.ok) throw new Error(result.error??'בדיקת החיבור נכשלה');
      if(!result.diagnostics) throw new Error('השרת עדיין אינו מכיל את עדכון בדיקת החיבור. יש לפרוס את הגרסה החדשה.');
      setDiagnostics(result.diagnostics);
    } catch(e:any) {setMessage(e.message||'לא ניתן להשלים את בדיקת החיבור.');}
    finally {setBusy(false);}
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primaryLight}/></View>;
  if (loadError) return <View style={s.center}><Text style={s.text}>{loadError}</Text><Button title="ניסיון נוסף" onPress={reload}/><Button title="חזרה" onPress={()=>router.replace('/settings')}/></View>;
  return <SafeAreaView style={s.root}>
    <View style={s.header}><Button title="→ חזרה" onPress={()=>router.replace('/settings')}/><Text style={s.title}>מוסד ולוח אקדמי</Text></View>
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Text style={s.text}>לוח משותף לכל מוסד, עם אפשרות להתאמה אישית שלך.</Text>
      {!!message && <Text accessibilityRole="alert" style={s.message}>{message}</Text>}
      <View style={s.card}>
        <Text style={s.title}>איפה לומדים?</Text>
        {institutions.map(i=><Button key={i.id} title={`${selected===i.id?'✓ ':''}${i.name}`} disabled={busy} onPress={()=>{setSelected(i.id);setSourceUrl(sources.find(x=>x.institution_id===i.id)?.page_url ?? '');}}/>)}
        {!selected && <Text style={s.hint}>בחרו מוסד כדי לראות את הלוחות שלו. אין שיוך אוטומטי ל־HIT.</Text>}
        {!!selected && <Button title="שמירת המוסד בפרופיל שלי" disabled={busy} onPress={()=>action(()=>saveProfile({institution_id:selected}),'המוסד נשמר בפרופיל. שנים קודמות לא שונו.')}/>}
        <Text style={s.hint}>מוסד שאינו ברשימה ניתן להוספה על ידי מנהל.</Text>
      </View>
      {!!selected && <View style={s.card}>
        <Text style={s.title}>לוחות של {institution?.name}</Text>
        {calendars.filter(c=>c.institution_id===selected).map(c=><View style={s.item} key={c.id}>
          <Text style={s.subtitle}>{c.label} · גרסה {c.revision}</Text><Text style={s.hint}>{calendarDates(c)}</Text>
          <Text style={s.hint}>{c.excluded_dates?.length ?? 0} ימים ללא לימודים · {c.origin==='manual'?'הוזן או נערך בידי מנהל':'יובא מהמקור הרשמי'}</Text>
          <Text style={s.hint}>עודכן: {dateTime(c.updated_at)}</Text>
          {!!c.source_url && <Button title="פתיחת המקור" onPress={()=>{if(/^https:\/\//.test(c.source_url!)) void Linking.openURL(c.source_url!);}}/>}
          <Button title="שימוש בלוח הזה בחשבון שלי" disabled={busy} onPress={()=>setAdopt(c)}/>
          {admin && <Button title="עריכת הלוח המשותף (מנהל)" disabled={busy} onPress={()=>{setNewYear(String(c.start_year));setNotes(c.notes);setEditor({mode:'shared',current:c});}}/>}
        </View>)}
        {!calendars.some(c=>c.institution_id===selected) && <Text style={s.hint}>עדיין אין לוח משותף למוסד הזה. אפשר להגדיר שנה אישית ידנית.</Text>}
        <Button title="+ שנה אישית ידנית" disabled={busy} onPress={()=>setEditor({mode:'personal',current:null})}/>
      </View>}
      <View style={s.card}>
        <Text style={s.title}>השנים שלי</Text>
        {years.map(y=><View key={y.id} style={s.item}><Text style={s.subtitle}>{y.id===activeId?'✓ ':''}{y.label}</Text><Text style={s.hint}>{institutions.find(i=>i.id===y.institution_id)?.name ?? 'נתונים קודמים — מוסד טרם שויך'} · {y.date_mode==='calendar'?'עותק של לוח משותף':'תאריכים אישיים'}</Text>
          <Button title="בחירת השנה כפעילה" disabled={busy||y.id===activeId} onPress={()=>action(()=>saveProfile({active_academic_year_id:y.id}),'השנה הפעילה עודכנה.')}/>
          <Button title="עריכת התאריכים שלי בלבד" disabled={busy} onPress={()=>{if(y.institution_id)setSelected(y.institution_id);if(!y.institution_id&&!selected){setMessage('בחרו מוסד לפני עריכת השנה.');return;}setEditor({mode:'personal',current:y});}}/>
        </View>)}
        {currentShared && currentShared.revision !== active?.calendar_revision && <Text style={s.message}>יש גרסה חדשה ללוח של השנה הפעילה. אפשר לבחור אותו מחדש למעלה. השינויים האישיים שלך נשמרים עד שתאשר החלפה.</Text>}
        <Text style={s.hint}>שינוי תאריכים חל על יצירת מפגשים חדשים בלבד. שיעורים, הערות ונוכחות שכבר שמורים לא משתנים.</Text>
      </View>
      <View style={s.card}><Button title={showProfile?'סגירת הפרטים האקדמיים':'עריכת הפרטים האקדמיים שלי'} onPress={()=>setShowProfile(!showProfile)}/>
        {showProfile && <>{profileFields.map(([key,label])=><View key={key}><Text style={s.hint}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={profile[key]??''} maxLength={200} onChangeText={v=>setProfile(p=>({...p,[key]:v}))}/></View>)}<Button title="שמירת הפרטים שלי" disabled={busy} onPress={()=>action(()=>saveProfile(),'הפרטים נשמרו בחשבון שלך.')}/></>}
      </View>
      {admin && <View style={s.card}>
        <Text style={s.title}>בדיקת חיבור והרשאות</Text>
        <Text style={s.hint}>בדיקה נפרדת של החיבור מ־Vercel ל־Supabase, בלי לפנות ל־HIT ובלי לשנות נתונים.</Text>
        <Button title="בדיקת חיבור והרשאות עכשיו" disabled={busy} onPress={diagnose}/>
        {diagnostics && <View accessibilityRole="alert" style={s.item}>
          <Text style={s.subtitle}>{diagnostics.ok?'✓ בדיקות החיבור עברו':'חלק מבדיקות החיבור נכשלו'}</Text>
          <Text style={s.hint}>{dateTime(diagnostics.checked_at)}</Text>
          {diagnostics.checks.map(c=><View key={c.id}><Text style={s.text}>{c.status==='pass'?'✓':'✕'} {c.label}</Text><Text style={s.hint}>{c.detail}</Text></View>)}
          <Text style={s.hint}>{diagnostics.scope}</Text>
        </View>}
      </View>}
      {admin && <View style={s.card}>
        <Text style={s.title}>ניהול מוסדות ולוחות</Text><Text style={s.hint}>עריכות כאן משותפות לכל המשתמשים. תאריכים אישיים לא נדרסים.</Text>
        <TextInput accessibilityLabel="שם מוסד חדש" placeholder="שם מוסד חדש" placeholderTextColor={Colors.textMuted} style={s.input} value={newName} onChangeText={setNewName}/>
        <TextInput accessibilityLabel="מזהה מוסד באנגלית" placeholder="מזהה באנגלית, למשל university-name" placeholderTextColor={Colors.textMuted} style={s.input} value={newSlug} autoCapitalize="none" onChangeText={setNewSlug}/>
        <Button title="הוספת מוסד" disabled={busy||!newName.trim()||!/^[a-z0-9-]+$/.test(newSlug)} onPress={()=>action(async()=>{check(await supabase.from('institutions').insert({name:newName.trim(),slug:newSlug}));setNewName('');setNewSlug('');},'המוסד נוסף. ניתן ליצור עבורו לוח ידני.')}/>
        {!!selected && <><Text style={s.subtitle}>לוח חדש עבור {institution?.name}</Text><Text style={s.hint}>השנה הלועזית שבה מתחילה שנת הלימודים</Text><TextInput accessibilityLabel="שנת תחילת הלוח" style={s.input} value={newYear} onChangeText={setNewYear} keyboardType="numeric"/><TextInput accessibilityLabel="הערות ללוח המשותף" style={s.input} multiline placeholder="הערות ללוח" placeholderTextColor={Colors.textMuted} value={notes} onChangeText={setNotes}/><Button title="הגדרת תאריכים ללוח משותף חדש" disabled={busy} onPress={()=>setEditor({mode:'shared',current:null})}/></>}
      </View>}
      {admin && source && <View style={s.card}>
        <Text style={s.title}>סנכרון {institution?.name}</Text><Text style={s.hint}>בדיקה אחרונה: {dateTime(source.last_checked_at)}{ '\n' }קריאה מוצלחת: {dateTime(source.last_success_at)}</Text>
        <TextInput accessibilityLabel="כתובת מקור הלוח" style={s.input} value={sourceUrl||source.page_url} onChangeText={setSourceUrl} autoCapitalize="none"/>
        <Button title="שמירת כתובת המקור" disabled={busy} onPress={()=>action(async()=>{check(await supabase.from('calendar_sources').update({page_url:sourceUrl||source.page_url}).eq('id',source.id));},'כתובת המקור עודכנה.')}/>
        <View style={s.toggle}><Text style={s.text}>סנכרון פעיל</Text><Switch accessibilityLabel="סנכרון פעיל" value={source.enabled} disabled={busy} onValueChange={value=>action(async()=>{check(await supabase.from('calendar_sources').update({enabled:value}).eq('id',source.id));},'הגדרת הסנכרון נשמרה.')}/></View>
        <View style={s.toggle}><Text style={s.text}>פרסום אוטומטי של שנים חדשות</Text><Switch accessibilityLabel="פרסום אוטומטי" value={source.auto_publish_new_years} disabled={busy} onValueChange={value=>action(async()=>{check(await supabase.from('calendar_sources').update({auto_publish_new_years:value}).eq('id',source.id));},'העדפת הפרסום נשמרה.')}/></View>
        <Text style={s.hint}>הלוח הראשון דורש אישור מנהל. אחריו שנים חדשות יפורסמו אוטומטית רק אם אין בעיות בחילוץ. שינוי בשנה קיימת תמיד ממתין לאישור.</Text>
        <Button title="בדיקת המקור עכשיו" disabled={busy||!source.enabled} onPress={sync}/>
        {runs.filter(r=>r.source_id===source.id).map(r=><View style={s.item} key={r.id}><Text style={s.subtitle}>{({review:'ממתין לבדיקה',published:'פורסם',failed:'נכשל',unchanged:'ללא שינוי',approved:'אושר',dismissed:'נדחה'} as Record<string,string>)[r.status]}</Text><Text style={s.hint}>{dateTime(r.created_at)}{ '\n' }{r.message}</Text>{r.candidate && <><Text style={s.text}>{r.candidate.label}</Text><Text style={s.hint}>{calendarDates(r.candidate)}</Text><Text style={s.hint}>ימים ללא לימודים: {r.candidate.excluded_dates?.join(', ') || 'אין'}</Text><Text style={s.hint}>{r.candidate.notes}</Text></>}{r.status==='review'&&<><Button title="אישור ופרסום הלוח" disabled={busy} onPress={()=>setReview(r)}/><Button title="דחיית ההצעה" disabled={busy} onPress={()=>action(async()=>{check(await supabase.rpc('review_calendar_run',{p_run_id:r.id,p_approve:false}));},'ההצעה נדחתה. הלוח הקודם נשמר.')}/></>}</View>)}
      </View>}
    </ScrollView>
    <AcademicYearModal initialLabel={editor?.mode==='shared' ? `${newYear}-${Number(newYear)+1}` : undefined} title={editor?.mode==='shared' ? 'עריכת לוח משותף' : 'תאריכים אישיים בלבד'} visible={!!editor} current={editor?.current??null} onSave={saveEditor} onClose={()=>setEditor(null)}/>
    <ConfirmModal visible={!!adopt} title="שימוש בלוח המוסד" message="יישמר עותק אישי וייבחר כשנה הפעילה. אם כבר השתמשת בלוח הזה, התאריכים והימים ללא לימודים שהגדרת בו יוחלפו. מפגשים קיימים לא ישתנו." confirmLabel="שימוש בלוח" cancelLabel="ביטול" onCancel={()=>setAdopt(null)} onConfirm={()=>{const id=adopt!.id;setAdopt(null);void action(async()=>{check(await supabase.rpc('adopt_institution_calendar',{p_calendar_id:id}));},'הלוח נשמר בחשבון שלך. אפשר להתחיל להוסיף קורסים.');}}/>
    <ConfirmModal visible={!!review} title="פרסום לוח משותף" message="התאריכים שחולצו יהפכו ללוח המשותף של המוסד והשנה הזו, ויחליפו גרסה משותפת קיימת. בדקת אותם מול המקור?" confirmLabel="אישור ופרסום" cancelLabel="ביטול" onCancel={()=>setReview(null)} onConfirm={()=>{const id=review!.id;setReview(null);void action(async()=>{check(await supabase.rpc('review_calendar_run',{p_run_id:id,p_approve:true}));},'הלוח פורסם. עותקים אישיים לא שונו.');}}/>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},center:{flex:1,justifyContent:'center',padding:24,gap:20},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16},
  body:{padding:20,gap:20,paddingBottom:50},card:{padding:18,gap:12,backgroundColor:Colors.card,borderRadius:20,borderWidth:1,borderColor:Colors.cardBorder},
  item:{paddingVertical:12,gap:10,borderTopWidth:1,borderTopColor:Colors.border},title:{fontFamily:'Heebo_700Bold',color:Colors.text,fontSize:20,textAlign:'right'},
  subtitle:{fontFamily:'Heebo_600SemiBold',color:Colors.text,fontSize:16,textAlign:'right'},text:{fontFamily:'Heebo_400Regular',color:Colors.textSecondary,textAlign:'right',fontSize:14},
  hint:{fontFamily:'Heebo_400Regular',color:Colors.textSecondary,textAlign:'right',fontSize:12,lineHeight:22},message:{fontFamily:'Heebo_500Medium',color:'#FCD34D',textAlign:'right',lineHeight:24},
  button:{padding:12,backgroundColor:Colors.background,borderRadius:10,alignItems:'center'},link:{fontFamily:'Heebo_600SemiBold',color:'#C4B5FD',textAlign:'center'},
  input:{padding:12,borderWidth:1,borderColor:'#38384F',borderRadius:10,color:Colors.text,textAlign:'right',fontFamily:'Heebo_400Regular'},toggle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},
});
