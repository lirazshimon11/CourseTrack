import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session, AttendanceStatus } from '../types';
import { SessionItem } from './SessionItem';

interface WeekSectionProps {
  weekNumber: string;
  sessions: Session[];
  onSessionPress: (session: Session) => void;
  onStatusChange: (sessionId: string, status: AttendanceStatus) => void;
}

export function WeekSection({ weekNumber, sessions, onSessionPress, onStatusChange }: WeekSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        <View style={styles.weekLine} />
        <Text style={styles.weekLabel}>שבוע {weekNumber}</Text>
        <View style={styles.weekLine} />
      </View>
      {sessions.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          onPress={() => onSessionPress(session)}
          onStatusChange={(status) => onStatusChange(session.id, status)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  weekLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  weekLabel: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_700Bold',
    color: Colors.primary,
    textAlign: 'center',
  },
});
