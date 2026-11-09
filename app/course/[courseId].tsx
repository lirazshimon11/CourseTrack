import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { useSessions } from '../../hooks/useSessions';
import { useCourses } from '../../hooks/useCourses';
import { SessionDetailSheet } from '../../components/SessionDetailSheet';
import { WeekSection } from '../../components/WeekSection';
import { Session, AttendanceStatus, SessionType, Course } from '../../types';
import { groupSessionsByWeek } from '../../lib/dateUtils';
import { Disclosure, ui } from '../../components/SettingsUI';
import { CreateCourseModal } from '../../components/CreateCourseModal';
import { BackButton } from '../../components/BackButton';

type TabType = 'lecture' | 'exercise';
type FilterType = 'all' | 'attended' | 'missed';

const CourseScreen = () => {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const router = useRouter();
  const { courses, recreateSessions } = useCourses();
  const course = courses.find(c => c.id === courseId);

  const [activeTab, setActiveTab] = useState<TabType>('lecture');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isCourseInfoVisible, setIsCourseInfoVisible] = useState(false);

  const { sessions, loading: loadingSessions, updateAttendance, updateNotes, refresh: refreshSessions } = useSessions(courseId, activeTab);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasAttemptedRegen, setHasAttemptedRegen] = useState(false);

  // Empty tabs are valid (e.g. a lab without tutorials). Never rebuild all
  // sessions automatically when viewing one of them.

  const grouped = useMemo(() => {
    let filteredSessions = sessions;
    if (activeFilter === 'attended') {
      filteredSessions = sessions.filter(s => s.attendance === 'attended');
    } else if (activeFilter === 'missed') {
      filteredSessions = sessions.filter(s => s.attendance === 'missed');
    }
    return groupSessionsByWeek(filteredSessions);
  }, [sessions, activeFilter]);

  const listRef = React.useRef<FlatList>(null);
  const scrolledTabsRef = React.useRef<Record<string, boolean>>({});

  const initialIndex = useMemo(() => {
    if (grouped.length === 0) return 0;
    
    // Use local Date to avoid timezone shifts
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const index = grouped.findIndex(week =>
      week.sessions.some(s => s.date >= today)
    );
    return index === -1 ? grouped.length - 1 : index;
  }, [grouped]);

  React.useEffect(() => {
    // Only scroll if there are items, and we HAVEN'T scrolled for this tab yet.
    if (grouped.length > 0 && !scrolledTabsRef.current[activeTab]) {
      const timer = setTimeout(() => {
        if (listRef.current) {
          scrolledTabsRef.current[activeTab] = true;
          listRef.current.scrollToIndex({
            index: initialIndex,
            animated: false,
            viewPosition: 0,
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [grouped.length, initialIndex, activeTab]);

  const allCount = sessions.length;
  const attendedCount = sessions.filter(s => s.attendance === 'attended').length;
  const missedCount = sessions.filter(s => s.attendance === 'missed').length;

  const handleAttendanceChange = async (sessionId: string, attendance: AttendanceStatus) => {
    await updateAttendance(sessionId, attendance);
    // Refresh selected session
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, attendance } : null);
    }
  };

  const handleNotesChange = async (sessionId: string, notes: string) => {
    const result = await updateNotes(sessionId, notes);
    if (result.success && result.session && selectedSession?.id === sessionId) {
      setSelectedSession(result.session);
      return true;
    }
    return false;
  };

  const semesterColor = course?.color || '#3B82F6';

  const TABS: { key: TabType; label: string }[] = [
    { key: 'lecture', label: 'הרצאות' },
    { key: 'exercise', label: 'תרגולים' },
  ];

  const FILTERS: { key: FilterType; label: string; count?: number }[] = [
    { key: 'attended', label: 'נצפו', count: attendedCount },
    { key: 'all', label: 'הכל', count: allCount },
    { key: 'missed', label: 'לא נצפו', count: missedCount },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton color={semesterColor} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => setIsCourseInfoVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.courseName} numberOfLines={1}>{course?.name ?? '...'}</Text>
          {course && (
            <View style={[styles.semBadge, { backgroundColor: semesterColor + '22', borderColor: semesterColor + '55' }]}>
              <Text style={[styles.semBadgeText, { color: semesterColor }]}>סמסטר {course.semester}'</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {course?.course_code&&<View style={{marginHorizontal:20,marginBottom:12}}><Disclosure title="פרטי הקורס והמערכת"><Text style={ui.text}>{course.course_code} · {course.credits??'—'} נ״ז · {course.weekly_hours??'—'} שעות</Text>{course.slots_data.map((slot,i)=><View key={i}><Text style={ui.text}>{slot.type==='exercise'?'תרגול':'הרצאה / מעבדה'} · יום {'אבגדהוש'[slot.day_of_week]} · {slot.start_time}–{slot.end_time}</Text><Text style={ui.text}>{slot.lecturer||'מרצה לא הוגדר'} · {slot.room||'חדר לא הוגדר'}</Text></View>)}</Disclosure></View>}
      {/* Tabs: הרצאות / תרגולים */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderColor: semesterColor, backgroundColor: semesterColor + '15' }]}
            onPress={() => { setActiveTab(tab.key); setActiveFilter('all'); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: semesterColor, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && { borderColor: semesterColor, backgroundColor: semesterColor + '15' }]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterText, activeFilter === f.key && { color: semesterColor }]}>
              {f.label}{f.count !== undefined ? ` (${f.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {(loadingSessions || isRegenerating) ? (
        <View style={styles.center}>
          <ActivityIndicator color={semesterColor} size="large" />
          {isRegenerating && (
            <Text style={[styles.loadingText, { color: semesterColor }]}>מייצר את המפגשים בפעם הראשונה...</Text>
          )}
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{activeTab === 'lecture' ? '🎓' : '📚'}</Text>
          <Text style={styles.emptyTitle}>
            {activeFilter !== 'all'
              ? `אין ${activeFilter === 'attended' ? 'נצפות' : 'לא נצפות'} עדיין`
              : `אין ${activeTab === 'lecture' ? 'הרצאות' : 'תרגולים'} מוגדרים`}
          </Text>
          {activeFilter === 'all' && (
            <TouchableOpacity
              style={[styles.regenBtn, { borderColor: semesterColor }]}
              onPress={() => recreateSessions(courseId)}
            >
              <Text style={[styles.regenBtnText, { color: semesterColor }]}>📅 יצירת רשימה מחדש</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={grouped}
          extraData={sessions}
          keyExtractor={item => String(item.weekNumber)}
          initialNumToRender={50} // Guarantee items are rendered so scrollToIndex doesn't fail
          maxToRenderPerBatch={50}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false });
            });
          }}
          renderItem={({ item }) => (
            <WeekSection
              weekNumber={item.weekNumber}
              sessions={item.sessions}
              onSessionPress={setSelectedSession}
              onStatusChange={handleAttendanceChange}
              themeColor={semesterColor}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Session detail bottom sheet */}
      <SessionDetailSheet
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onNotesChange={handleNotesChange}
        onStatusChange={handleAttendanceChange}
        themeColor={semesterColor}
      />

      <CreateCourseModal
        visible={isCourseInfoVisible}
        courseToEdit={course}
        readOnly={true}
        onClose={() => setIsCourseInfoVisible(false)}
        academicYear={null}
        onSave={async () => ({ success: true })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  courseName: {
    fontSize: FontSize.xl,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  semBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  semBadgeText: { fontSize: FontSize.xs, fontFamily: 'Heebo_500Medium' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabText: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_500Medium',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: 'Heebo_700Bold',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterText: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_500Medium',
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.primaryLight,
    fontFamily: 'Heebo_600SemiBold',
  },
  list: { padding: Spacing.md, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  regenBtn: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  regenBtnText: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_700Bold',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    fontFamily: 'Heebo_500Medium',
    textAlign: 'center',
  },
});

export default CourseScreen;
