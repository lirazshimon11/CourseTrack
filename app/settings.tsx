import React, { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAcademicYear } from '../hooks/useAcademicYear';
import { useCourses } from '../hooks/useCourses';
import { AcademicYearModal } from '../components/AcademicYearModal';
import { ConfirmModal } from '../components/ConfirmModal';

export default function SettingsScreen() {
  const router = useRouter();
  const { academicYear, saveYear } = useAcademicYear();
  const { deleteAllData } = useCourses();
  const [email, setEmail] = useState('');
  const [showYear, setShowYear] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);
  const signOut = async () => {
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage('ההתנתקות נכשלה. נסו שוב.'); setBusy(false); }
  };
  const remove = async () => {
    setConfirm(false); setBusy(true); setMessage('');
    try { await deleteAllData(); setMessage('הקורסים והמפגשים שלך נמחקו. הגדרות השנה נשמרו.'); }
    catch { setMessage('המחיקה נכשלה. נסו שוב.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={s.root}>
    <View style={s.header}><TouchableOpacity onPress={() => router.replace('/')}><Text style={s.link}>→ לקורסים שלי</Text></TouchableOpacity><Text style={s.title}>הגדרות</Text></View>
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.card}><Text style={s.title}>המוסד והלוח האקדמי שלי</Text><Text style={s.hint}>בחירת מוסד ושנה, שימוש בלוח משותף או הגדרת תאריכים אישיים. למנהלים מוצגים גם כלי ניהול וסנכרון.</Text><TouchableOpacity style={s.button} onPress={() => router.push('/calendars')}><Text style={s.link}>מוסדות, לוחות ופרופיל לימודים</Text></TouchableOpacity></View>
      <View style={s.card}><Text style={s.title}>החשבון שלי</Text><Text style={s.text}>{email}</Text><Text style={s.hint}>הקורסים וההתקדמות נשמרים בחשבון הזה.</Text><TouchableOpacity disabled={busy} style={s.button} onPress={signOut}><Text style={s.link}>התנתקות מהחשבון</Text></TouchableOpacity></View>
      <View style={s.card}><Text style={s.title}>שנת הלימודים</Text><Text style={s.text}>{academicYear?.label ?? 'עדיין לא הוגדרה'}</Text><Text style={s.hint}>תאריכי הסמסטר משמשים ליצירת השיעורים בקורסים חדשים. שינוי התאריכים לא משנה שיעורים קיימים.</Text><TouchableOpacity style={s.button} onPress={() => setShowYear(true)}><Text style={s.link}>עריכת תאריכי הסמסטרים</Text></TouchableOpacity></View>
      {!!message && <Text accessibilityRole="alert" style={s.text}>{message}</Text>}
      <View style={s.card}><Text style={s.title}>איפוס הקורסים</Text><Text style={s.hint}>מחיקת כל הקורסים, המפגשים וההערות בחשבון שלך. הפעולה אינה הפיכה.</Text><TouchableOpacity disabled={busy} style={s.button} onPress={() => setConfirm(true)}><Text style={{ color: Colors.danger, fontFamily: 'Heebo_500Medium' }}>{busy ? 'רגע…' : 'מחיקת הקורסים שלי'}</Text></TouchableOpacity></View>
      <Text style={s.hint}>CourseTrack · סביבת הלימודים שלך</Text>
    </ScrollView>
    <AcademicYearModal visible={showYear} current={academicYear} onSave={saveYear} onClose={() => setShowYear(false)} />
    <ConfirmModal visible={confirm} title="מחיקת הקורסים שלי" message="כל הקורסים, המפגשים וההערות בחשבון הזה יימחקו לצמיתות. להמשיך?" confirmLabel="מחיקה לצמיתות" cancelLabel="ביטול" isDestructive onConfirm={remove} onCancel={() => setConfirm(false)} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  body: { padding: 24, gap: 22 }, card: { padding: 22, borderRadius: 20, backgroundColor: Colors.card, gap: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  title: { color: Colors.text, fontFamily: 'Heebo_700Bold', fontSize: 20, textAlign: 'right' },
  text: { color: Colors.textSecondary, fontFamily: 'Heebo_400Regular', fontSize: 15, textAlign: 'right' },
  hint: { color: Colors.textSecondary, fontFamily: 'Heebo_400Regular', fontSize: 13, textAlign: 'right', lineHeight: 23 },
  link: { color: '#C4B5FD', fontFamily: 'Heebo_600SemiBold', textAlign: 'center' },
  button: { padding: 14, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center' },
});
