import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session } from '../types';
import { formatHebrewDate, formatTime, getSessionLabel } from '../lib/dateUtils';

interface SessionItemProps {
  session: Session;
  onPress: () => void;
}

const ATTENDANCE_CONFIG = {
  attended: { color: Colors.attended, label: '✓ נצפה', bg: Colors.attended + '18' },
  missed:   { color: Colors.missed,   label: '✗ לא נצפה', bg: Colors.missed + '18' },
};

export function SessionItem({ session, onPress }: SessionItemProps) {
  const isLecture = session.type === 'lecture';
  const accentColor = isLecture ? Colors.lectureColor : Colors.exerciseColor;
  const label = getSessionLabel(session);
  const dateLabel = formatHebrewDate(session.date);
  const timeLabel = `${formatTime(session.start_time)}–${formatTime(session.end_time)}`;
  const attendance = session.attendance ? ATTENDANCE_CONFIG[session.attendance] : null;
  const hasNotes = session.notes && session.notes.trim().length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.label}>{label} – {dateLabel}</Text>
          {attendance && (
            <View style={[styles.badge, { backgroundColor: attendance.bg, borderColor: attendance.color + '55' }]}>
              <Text style={[styles.badgeText, { color: attendance.color }]}>{attendance.label}</Text>
            </View>
          )}
        </View>
        <Text style={styles.time}>{timeLabel}</Text>
        {hasNotes && (
          <Text style={styles.notesSnippet} numberOfLines={1}>📝 {session.notes}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.text,
    textAlign: 'left',
    flex: 1,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: 'Heebo_500Medium',
  },
  time: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  notesSnippet: {
    fontSize: FontSize.xs,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted,
    textAlign: 'left',
  },
});
