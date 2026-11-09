import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/theme';
import { BackButton } from '../components/BackButton';

type HistoryCourse = { id: string; year_label: string; semester: string; term_end: string; course_name: string; notes: { type: string; number: number; date: string; notes: string }[] };
export default function HistoryScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<HistoryCourse[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const { data, error } = await supabase.from('course_history').select('*').order('term_end', { ascending: false }).order('course_name');
    setError(!!error); setCourses(data ?? []); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const course = courses.find(c => c.id === selected);
  const groups = new Map<string, HistoryCourse[]>();
  for (const c of courses) {
    const key = `${c.year_label} · סמסטר ${c.semester}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return <SafeAreaView style={styles.root}>
    <View style={styles.nav}><BackButton label={selected ? 'חזרה לרשימת הקורסים' : 'חזרה'} onPress={() => selected ? setSelected(null) : router.back()} /></View>
    <Text style={styles.title}>{course?.course_name ?? 'היסטוריית קורסים'}</Text>
    <Text style={styles.text}>{course ? `${course.year_label} · סמסטר ${course.semester}` : 'ההערות שנשמרו מסמסטרים קודמים'}</Text>
    {loading ? <ActivityIndicator color={Colors.primary} /> : error ? <TouchableOpacity accessibilityRole="button" onPress={() => void load()}><Text style={styles.link}>לא ניתן לטעון את ההיסטוריה. לחצו לנסות שוב</Text></TouchableOpacity> :
      <ScrollView contentContainerStyle={styles.list}>
        {course ? course.notes.map((note, i) => <View key={i} style={styles.card}>
          <Text style={styles.heading}>{note.type === 'lecture' ? 'הרצאה' : 'תרגול'} {note.number} · {note.date.split('-').reverse().join('.')}</Text>
          <Text selectable style={styles.text}>{note.notes}</Text>
        </View>) : [...groups].map(([label, items]) => <View key={label} style={styles.list}>
          <Text style={styles.heading}>{label}</Text>
          {items.map(c => <TouchableOpacity key={c.id} accessibilityRole="button" style={styles.card} onPress={() => setSelected(c.id)}>
            <Text style={styles.heading}>{c.course_name}</Text><Text style={styles.text}>{c.notes.length} מפגשים עם הערות ←</Text>
          </TouchableOpacity>)}
        </View>)}
        {!courses.length && <Text style={styles.text}>אין עדיין קורסים בהיסטוריה. בסיום הסמסטר אפשר לשמור כאן את ההערות שלך.</Text>}
      </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, padding: 20, gap: 14 },
  nav: { flexDirection: 'row-reverse' },
  title: { fontFamily: 'Heebo_700Bold', fontSize: 26, color: Colors.text, textAlign: 'right' },
  heading: { fontFamily: 'Heebo_600SemiBold', fontSize: 18, color: Colors.text, textAlign: 'right' },
  text: { fontFamily: 'Heebo_400Regular', color: Colors.textSecondary, textAlign: 'right', lineHeight: 25 },
  link: { fontFamily: 'Heebo_600SemiBold', color: Colors.primaryLight, textAlign: 'right', paddingVertical: 10 },
  card: { backgroundColor: Colors.card, padding: 18, borderRadius: 14, gap: 10 },
  list: { gap: 14, paddingBottom: 24 },
});
