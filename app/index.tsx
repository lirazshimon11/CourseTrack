import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useCourses } from '../hooks/useCourses';
import { useAcademicYear } from '../hooks/useAcademicYear';
import { CourseCard } from '../components/CourseCard';
import { CreateCourseModal } from '../components/CreateCourseModal';
import { AcademicYearModal } from '../components/AcademicYearModal';
import { Semester, ScheduleSlot } from '../types';

const HomeScreen = () => {
  const router = useRouter();
  const { courses, loading, createCourse, deleteCourse } = useCourses();
  const { academicYear, saveYear } = useAcademicYear();

  const [showCreate, setShowCreate] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);

  const handleCreateCourse = async (
    name: string,
    semester: Semester,
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[]
  ) => {
    if (!academicYear) {
      Alert.alert('שגיאה', 'יש להגדיר שנה אקדמית תחילה');
      return { error: 'no academic year' };
    }
    return await createCourse(name, semester, academicYear.id, lectureSlots, exerciseSlots, academicYear);
  };

  const handleLongPress = (courseId: string, courseName: string) => {
    Alert.alert(
      'מחיקת קורס',
      `האם למחוק את הקורס "${courseName}"?\nפעולה זו תמחק גם את כל המפגשים.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק', style: 'destructive',
          onPress: async () => {
            const { error } = await deleteCourse(courseId);
            if (error) Alert.alert('שגיאה', 'מחיקה נכשלה');
          },
        },
      ]
    );
  };

  const yearLabel = academicYear?.label ?? 'הגדר שנה אקדמית';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.yearBtn}
          onPress={() => setShowYearModal(true)}
        >
          <Text style={styles.yearBtnIcon}>🎓</Text>
          <Text style={styles.yearBtnText}>שנה {yearLabel}</Text>
          <Text style={styles.yearBtnChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>הקורסים שלי</Text>
        <Text style={styles.subtitle}>
          {courses.length === 0 ? 'לחץ + כדי להוסיף קורס' : `${courses.length} קורסים`}
        </Text>
      </View>

      {/* Course list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : courses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>אין קורסים עדיין</Text>
          <Text style={styles.emptyText}>לחץ על הכפתור + למטה כדי ליצור קורס חדש</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              onPress={() => router.push(`/course/${item.id}`)}
              onLongPress={() => handleLongPress(item.id, item.name)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => {
        if (!academicYear) {
          Alert.alert(
            'הגדרת שנה אקדמית',
            'צריך להגדיר את תאריכי הסמסטרים קודם',
            [
              { text: 'ביטול', style: 'cancel' },
              { text: 'הגדר עכשיו', onPress: () => setShowYearModal(true) },
            ]
          );
        } else {
          setShowCreate(true);
        }
      }}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modals */}
      <CreateCourseModal
        visible={showCreate}
        academicYear={academicYear}
        onClose={() => setShowCreate(false)}
        onSave={handleCreateCourse}
      />
      <AcademicYearModal
        visible={showYearModal}
        current={academicYear}
        onClose={() => setShowYearModal(false)}
        onSave={saveYear}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  yearBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  yearBtnIcon: { fontSize: 14 },
  yearBtnText: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.primaryLight,
  },
  yearBtnChevron: { fontSize: 16, color: Colors.textMuted },
  settingsBtn: { padding: Spacing.xs },
  settingsIcon: { fontSize: 22 },
  titleRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted,
    textAlign: 'left',
    marginTop: 2,
  },
  list: { paddingTop: Spacing.xs, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl, gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: {
    fontSize: FontSize.xl, fontFamily: 'Heebo_700Bold',
    color: Colors.text, textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md, fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted, textAlign: 'center', lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: Colors.text,
    fontFamily: 'Heebo_400Regular',
    lineHeight: 36,
    marginTop: -2,
  },
});
