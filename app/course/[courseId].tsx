import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { useSessions } from '../../hooks/useSessions';
import { useCourses } from '../../hooks/useCourses';
import { SessionDetailSheet } from '../../components/SessionDetailSheet';
import { WeekSection } from '../../components/WeekSection';
import { Session, AttendanceStatus, SessionType } from '../../types';
import { groupSessionsByWeek } from '../../lib/dateUtils';

type TabType = 'lecture' | 'exercise';
type FilterType = 'all' | 'attended' | 'missed';

const CourseScreen = () => {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const router = useRouter();
  const { courses } = useCourses();
  const course = courses.find(c => c.id === courseId);

  const [activeTab, setActiveTab] = useState<TabType>('lecture');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const { sessions, loading, updateAttendance, updateNotes } = useSessions(courseId, activeTab);

  const filteredSessions = useMemo(() => {
    if (activeFilter === 'all') return sessions;
    return sessions.filter(s => s.attendance === activeFilter);
  }, [sessions, activeFilter]);

  const grouped = useMemo(() => groupSessionsByWeek(filteredSessions), [filteredSessions]);

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
    await updateNotes(sessionId, notes);
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, notes } : null);
    }
  };

  const semesterColor = course?.color || Colors.primary;

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={Colors.primaryLight} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.courseName} numberOfLines={1}>{course?.name ?? '...'}</Text>
          {course && (
            <View style={[styles.semBadge, { backgroundColor: semesterColor + '22', borderColor: semesterColor + '55' }]}>
              <Text style={[styles.semBadgeText, { color: semesterColor }]}>סמסטר {course.semester}'</Text>
            </View>
          )}
        </View>
      </View>

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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={semesterColor} size="large" />
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{activeTab === 'lecture' ? '🎓' : '📚'}</Text>
          <Text style={styles.emptyTitle}>
            {activeFilter !== 'all'
              ? `אין ${activeFilter === 'attended' ? 'נצפות' : 'לא נצפות'} עדיין`
              : `אין ${activeTab === 'lecture' ? 'הרצאות' : 'תרגולים'} מוגדרים`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          extraData={sessions}
          keyExtractor={item => String(item.weekNumber)}
          renderItem={({ item }) => (
            <WeekSection
              weekNumber={item.weekNumber}
              sessions={item.sessions}
              onSessionPress={setSelectedSession}
              onStatusChange={handleAttendanceChange}
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
  backBtn: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primaryLight,
    fontFamily: 'Heebo_400Regular',
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
    textAlign: 'left',
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
  },
});

export default CourseScreen;
