import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/theme';

type EndedTerm = { year_id: string; year_label: string; semester: string; term_end: string };
export function SemesterCompletion({ onComplete }: { onComplete: () => Promise<void> }) {
  const [terms, setTerms] = useState<EndedTerm[]>([]);
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    supabase.rpc('ended_semesters').then(({ data, error }) => {
      if (active) { setTerms(data ?? []); setError(error ? 'לא ניתן לבדוק סמסטרים שהסתיימו. נסו לרענן.' : ''); }
    });
    return () => { active = false; };
  }, []);
  const term = terms[0];
  async function finish(keep: boolean) {
    if (lock.current || !term) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('finish_semester', { p_year_id: term.year_id, p_semester: term.semester, p_keep_notes: keep });
      if (error) throw error;
      setTerms(prev => prev.slice(1)); setDeleting(false);
      await onComplete();
    } catch { setError('הפעולה לא הושלמה. הנתונים לא נמחקו. נסו שוב.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    {!term && !!error && <Text style={styles.text}>{error}</Text>}
    <Modal visible={!!term && !hidden} transparent animationType="fade" onRequestClose={() => { if (!busy) setHidden(true); }}>
      <View style={styles.overlay}><View style={styles.card}>
        <Text style={styles.title}>{deleting ? 'מחיקת נתוני הסמסטר' : `סמסטר ${term?.semester} הסתיים`}</Text>
        <Text style={styles.text}>{term?.year_label}</Text>
        <Text style={styles.text}>{deleting ? 'כל הקורסים, המפגשים וההערות בסמסטר הזה יימחקו לצמיתות. לא יישמר עותק בהיסטוריה.' : 'לשמור את ההערות בהיסטוריה? יישמרו רק קורסים ומפגשים שיש בהם הערות, עם מספר המפגש והתאריך. יתר נתוני הסמסטר יימחקו.'}</Text>
        {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
        {busy ? <ActivityIndicator color={Colors.primary} /> : <>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => void finish(!deleting)}><Text style={styles.text}>{deleting ? 'מחיקת הסמסטר לצמיתות' : 'שמירת ההערות וסיום הסמסטר'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setDeleting(!deleting)}><Text style={styles.text}>{deleting ? 'שינוי בחירה' : 'לא לשמור — מחיקת נתוני הסמסטר'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setHidden(true); setDeleting(false); }}><Text style={styles.text}>אחליט מאוחר יותר</Text></TouchableOpacity>
        </>}
      </View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 24, gap: 18, width: '100%', maxWidth: 420 },
  title: { fontFamily: 'Heebo_700Bold', color: Colors.text, fontSize: 22, textAlign: 'right' },
  text: { fontFamily: 'Heebo_400Regular', color: Colors.text, textAlign: 'right', lineHeight: 24 },
  button: { padding: 14, borderRadius: 12, backgroundColor: Colors.primary },
});
