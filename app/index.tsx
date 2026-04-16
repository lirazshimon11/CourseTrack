import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useCourses } from '../hooks/useCourses';
import { useAcademicYear } from '../hooks/useAcademicYear';
import { CourseCard } from '../components/CourseCard';
import { CreateCourseModal } from '../components/CreateCourseModal';
import { AcademicYearModal } from '../components/AcademicYearModal';
import { CourseActionMenu } from '../components/CourseActionMenu';
import { SuccessToast } from '../components/SuccessToast';
import { ConfirmModal } from '../components/ConfirmModal';
import { JSReorderList } from '../components/JSReorderList';
import { Semester, ScheduleSlot, Course } from '../types';

const HomeScreen = () => {
  const router = useRouter();
  const { academicYear, saveYear } = useAcademicYear();
  const { courses, loading, createCourse, deleteCourse, updateCourse, reorderCourses, moveCourse } = useCourses(academicYear?.id);
  const [isDragging, setIsDragging] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [longPressedCourse, setLongPressedCourse] = useState<Course | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean, message: string }>({ visible: false, message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean, courseId: string }>({ visible: false, courseId: '' });

  const handleSaveCourse = async (
    name: string,
    semester: Semester,
    color: string,
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[]
  ) => {
    if (courseToEdit) {
      const res = await updateCourse(courseToEdit.id, name, semester, color, lectureSlots, exerciseSlots);
      if (res.success) {
        setToast({ visible: true, message: 'השינויים נשמרו בהצלחה' });
      }
      return res;
    }

    if (!academicYear) {
      setDeleteConfirm({ visible: true, courseId: 'YEAR_SETUP' });
      return { error: 'no academic year' };
    }
    const res = await createCourse(name, semester, color, academicYear.id, lectureSlots, exerciseSlots, academicYear);
    if (res.success) {
      setToast({ visible: true, message: 'הקורס נוצר בהצלחה' });
    }
    return res;
  };

  const handleLongPress = (course: Course, x: number, y: number) => {
    setLongPressedCourse(course);
    setMenuPosition({ x, y });
  };

  const handleEditCourse = (course: Course) => {
    setCourseToEdit(course);
    setShowCreate(true);
  };

  const confirmDelete = (courseId: string) => {
    setDeleteConfirm({ visible: true, courseId });
  };

  const handleDelete = async () => {
    const courseId = deleteConfirm.courseId;
    setDeleteConfirm({ visible: false, courseId: '' });
    const res = await deleteCourse(courseId);
    if (res.success) {
      setToast({ visible: true, message: 'הקורס נמחק' });
    }
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
        <ScrollView 
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDragging}
        >
          <JSReorderList
            data={courses}
            onReorder={reorderCourses}
            itemHeight={80} // 70 (height) + 10 (margin/spacing)
            onDragStateChange={setIsDragging}
            renderItem={(item, dragTrigger) => (
              <CourseCard
                course={item}
                onPress={() => router.push(`/course/${item.id}`)}
                onLongPress={handleLongPress}
                dragTrigger={dragTrigger}
              />
            )}
          />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => {
        if (!academicYear) {
          setDeleteConfirm({ visible: true, courseId: 'YEAR_SETUP' });
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
        courseToEdit={courseToEdit}
        onClose={() => { setShowCreate(false); setCourseToEdit(null); }}
        onSave={handleSaveCourse}
      />
      <AcademicYearModal
        visible={showYearModal}
        current={academicYear}
        onClose={() => setShowYearModal(false)}
        onSave={saveYear}
      />
      <CourseActionMenu
        course={longPressedCourse}
        position={menuPosition}
        visible={!!longPressedCourse}
        onClose={() => { setLongPressedCourse(null); setMenuPosition(null); }}
        onDelete={confirmDelete}
        onEdit={handleEditCourse}
      />
      
      <ConfirmModal
        visible={deleteConfirm.visible}
        title={deleteConfirm.courseId === 'YEAR_SETUP' ? "הגדרת שנה אקדמית" : "מחיקת קורס"}
        message={deleteConfirm.courseId === 'YEAR_SETUP' 
          ? "צריך להגדיר את תאריכי הסמסטרים לפני שניתן ליצור קורסים. האם תרצי לעשות זאת עכשיו?"
          : `האם אתה בטוח שברצונך למחוק את "${courses.find(c => c.id === deleteConfirm.courseId)?.name}"? האקשן זה ימחוק גם את כל המפגשים הקשורים.`
        }
        confirmLabel={deleteConfirm.courseId === 'YEAR_SETUP' ? "הגדר עכשיו" : "מחק"}
        cancelLabel="ביטול"
        onConfirm={deleteConfirm.courseId === 'YEAR_SETUP' ? () => { setDeleteConfirm({ visible: false, courseId: '' }); setShowYearModal(true); } : handleDelete}
        onCancel={() => setDeleteConfirm({ visible: false, courseId: '' })}
        isDestructive={deleteConfirm.courseId !== 'YEAR_SETUP'}
      />

      <SuccessToast 
        visible={toast.visible} 
        message={toast.message} 
        onHide={() => setToast({ visible: false, message: '' })} 
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
