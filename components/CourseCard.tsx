import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  onPress: () => void;
  onLongPress: () => void;
}

export function CourseCard({ course, onPress, onLongPress }: CourseCardProps) {
  const semesterColor =
    course.semester === 'א' ? '#7C3AED' :
    course.semester === 'ב' ? '#0EA5E9' : '#F59E0B';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.accentBar, { backgroundColor: semesterColor }]} />
      <View style={styles.content}>
        <Text style={styles.name}>{course.name}</Text>
        <View style={[styles.semesterBadge, { backgroundColor: semesterColor + '22', borderColor: semesterColor + '55' }]}>
          <Text style={[styles.semesterText, { color: semesterColor }]}>סמסטר {course.semester}'</Text>
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: FontSize.lg,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.text,
    flex: 1,
    textAlign: 'left',
  },
  semesterBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  semesterText: {
    fontSize: FontSize.xs,
    fontFamily: 'Heebo_500Medium',
  },
  arrow: {
    fontSize: 24,
    color: Colors.textMuted,
    paddingRight: Spacing.md,
  },
});
