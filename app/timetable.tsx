import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAcademicYear } from '../hooks/useAcademicYear';
import { useCourses } from '../hooks/useCourses';
import { TimetableExport } from '../components/TimetableExport';
import { Action, Page, ui } from '../components/SettingsUI';

export default function TimetableScreen() {
  const router = useRouter();
  const { academicYear, loading: yearLoading } = useAcademicYear();
  const { courses, loading } = useCourses(academicYear ? academicYear.id : null);

  return (
    <Page title="יצירת מערכת שעות">
      {yearLoading || loading ? (
        <View style={ui.card}>
          <ActivityIndicator color="#A78BFA" />
          <Text style={ui.text}>טוען את הקורסים למערכת…</Text>
        </View>
      ) : courses.length ? (
        <TimetableExport courses={courses} yearLabel={academicYear?.label ?? 'הקורסים שלי'} />
      ) : (
        <View style={ui.card}>
          <Text style={ui.subtitle}>אין עדיין קורסים למערכת השעות</Text>
          <Text style={ui.text}>הוסיפו קורסים לשנת הלימודים הפעילה או ייבאו מערכת שעות. לאחר מכן תוכלו לבחור כאן את הפרטים והעיצוב ולהוריד תמונה.</Text>
          <Action title="ייבוא מערכת שעות מ־PDF" onPress={() => router.push('/import')} />
          <Action secondary title="לקורסים שלי" onPress={() => router.push('/')} />
        </View>
      )}
    </Page>
  );
}
