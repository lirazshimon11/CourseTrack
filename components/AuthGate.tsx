import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/theme';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setLoading(false); if (error) setMessage('לא הצלחנו לשחזר את הכניסה. אפשר להיכנס שוב.'); }
    }).catch(() => { if (active) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setReady(false); setSession(next); setLoading(false);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) return;
    setChecking(true);
    supabase.rpc('coursetrack_access_ready').then(({ data, error }) => {
      if (active) { setReady(!error && data === true); setChecking(false); }
    });
    return () => { active = false; };
  }, [session]);

  const submit = async () => {
    if (busy) return;
    setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('צריך להזין כתובת אימייל תקינה.'); return; }
    if (password.length < (signup ? 8 : 1)) { setMessage(signup ? 'בחרו סיסמה עם לפחות 8 תווים.' : 'צריך להזין סיסמה.'); return; }
    setBusy(true);
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage(error.code === 'email_not_confirmed' ? 'צריך לאשר את כתובת האימייל דרך הקישור שקיבלתם.' : error.code === 'invalid_credentials' ? 'האימייל או הסיסמה אינם נכונים.' : 'לא הצלחנו להשלים את הפעולה. בדקו את הפרטים ונסו שוב בעוד רגע.');
      } else if (signup && !data.session) { setMessage('שלחנו קישור לאישור האימייל. אחרי האישור אפשר להיכנס כאן.'); setSignup(false); setPassword(''); }
    } catch { setMessage('לא ניתן להתחבר כרגע. בדקו את חיבור האינטרנט ונסו שוב.'); }
    finally { setBusy(false); }
  };

  if (loading || (session && checking)) return <View style={s.center}><ActivityIndicator color={Colors.primaryLight} /><Text style={s.description}>רגע, מכינים את סביבת הלימודים…</Text></View>;
  if (session && ready) return <React.Fragment key={session.user.id}>{children}</React.Fragment>;
  if (session) return <View style={s.center}><Text style={s.title}>עוד צעד קטן לפני שמתחילים</Text><Text style={s.description}>החשבון מחובר. מנהל האתר צריך להשלים את הגדרת החשבונות הנפרדים לפני שאפשר לפתוח את הקורסים.</Text><TouchableOpacity style={s.button} onPress={() => setSession({ ...session })}><Text style={s.buttonText}>בדיקה חוזרת</Text></TouchableOpacity><TouchableOpacity onPress={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage('ההתנתקות נכשלה. נסו שוב.'); }}><Text style={s.link}>התנתקות</Text></TouchableOpacity><Text style={s.description}>{message}</Text></View>;

  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><Text style={s.logo}>🎓</Text><Text style={s.wordmark}>CourseTrack</Text><Text style={s.badge}>כל הלימודים, במקום אחד</Text></View>
    <Text style={s.title}>{signup ? 'מתחילים ללמוד בראש שקט' : 'טוב שחזרת ללמוד'}</Text>
    <Text style={s.description}>הקורסים, השיעורים וההתקדמות שלך.{ '\n' }סביבת לימודים אישית, בקצב שלך.</Text>
    <View style={s.card}>
      <View style={s.tabs}>{[false, true].map(value => <TouchableOpacity key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: signup === value }} disabled={busy} style={[s.tab, signup === value && s.activeTab]} onPress={() => { setSignup(value); setMessage(''); }}><Text style={s.buttonText}>{value ? 'יצירת חשבון' : 'כניסה לחשבון'}</Text></TouchableOpacity>)}</View>
      {signup && <><Text style={s.label}>איך קוראים לך? (לא חובה)</Text><TextInput accessibilityLabel="שם" style={s.input} value={name} onChangeText={setName} placeholder="השם שלך" placeholderTextColor={Colors.textMuted} /></>}
      <Text style={s.label}>אימייל</Text><TextInput accessibilityLabel="אימייל" style={[s.input, s.ltr]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" placeholderTextColor={Colors.textMuted} />
      <Text style={s.label}>סיסמה</Text><TextInput accessibilityLabel="סיסמה" style={[s.input, s.ltr]} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'לפחות 8 תווים' : 'הסיסמה שלך'} placeholderTextColor={Colors.textMuted} onSubmitEditing={submit} />
      {!!message && <Text accessibilityRole="alert" style={s.message}>{message}</Text>}
      <TouchableOpacity accessibilityRole="button" style={[s.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>{signup ? 'יצירת הסביבה שלי' : 'כניסה לסביבת הלימודים ←'}</Text>}</TouchableOpacity>
    </View>
    <View style={s.features}><Text style={s.description}>📚  הקורסים שלך  ·  ✓  מעקב התקדמות  ·  ✎  הערות לשיעורים</Text></View>
    <Text style={s.footnote}>פעם ראשונה? יוצרים חשבון ומגדירים את הסמסטר בכמה צעדים פשוטים.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 28, gap: 20 },
  page: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingVertical: 44, gap: 16 },
  brand: { alignItems: 'center', gap: 7, marginBottom: 18 }, logo: { fontSize: 44 },
  wordmark: { color: Colors.text, fontFamily: 'Heebo_700Bold', fontSize: 27 },
  badge: { color: '#C4B5FD', backgroundColor: Colors.glassLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 24, fontFamily: 'Heebo_500Medium' },
  title: { color: Colors.text, fontSize: 26, fontFamily: 'Heebo_700Bold', textAlign: 'center' },
  description: { color: Colors.textSecondary, fontFamily: 'Heebo_400Regular', fontSize: 14, lineHeight: 24, textAlign: 'center' },
  card: { padding: 22, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, gap: 10, marginTop: 10 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.background, padding: 4, borderRadius: 12, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' }, activeTab: { backgroundColor: Colors.primary },
  label: { color: Colors.textSecondary, fontFamily: 'Heebo_500Medium', textAlign: 'right', marginTop: 6 },
  input: { backgroundColor: Colors.background, color: Colors.text, borderRadius: 12, borderWidth: 1, borderColor: '#38384F', padding: 14, fontFamily: 'Heebo_400Regular', fontSize: 15, textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  button: { backgroundColor: Colors.primary, borderRadius: 12, minHeight: 50, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  buttonText: { color: Colors.text, fontFamily: 'Heebo_600SemiBold', fontSize: 14 },
  message: { color: '#FCD34D', textAlign: 'right', fontFamily: 'Heebo_400Regular', lineHeight: 22 },
  link: { color: '#C4B5FD', textAlign: 'center' }, features: { marginTop: 12 },
  footnote: { color: Colors.textMuted, fontFamily: 'Heebo_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
