import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  onPress: () => void;
  onLongPress: (course: Course, x: number, y: number) => void;
  dragTrigger: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export function CourseCard({ course, onPress, onLongPress, dragTrigger, selectionMode = false, selected = false, onToggle }: CourseCardProps) {
  const semesterColor = course.color || '#3B82F6';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.accentBar, { backgroundColor: semesterColor }]}
          onLongPress={selectionMode ? undefined : dragTrigger}
          disabled={selectionMode}
          delayLongPress={100}
        />
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={100}
          accessibilityLabel={selectionMode ? `${selected ? 'ביטול בחירה של' : 'בחירה של'} ${course.name}` : course.name}
          accessibilityRole={selectionMode ? 'checkbox' : 'button'}
          accessibilityState={{ checked: selectionMode ? selected : undefined }}
          onPress={selectionMode ? onToggle : onPress}
          onLongPress={(e) => {
            if (!selectionMode) onLongPress(course, e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          style={styles.cardBody}
        >
          <View style={styles.content}>
            <View style={[styles.semesterBadge, { backgroundColor: semesterColor + '22', borderColor: semesterColor + '55' }]}>
              <Text style={[styles.semesterText, { color: semesterColor }]}>סמסטר {course.semester}'</Text>
            </View>
            <Text style={styles.name}>{course.name}</Text>
            {selectionMode && <View style={[styles.selection, selected && styles.selectionActive]}><Text style={styles.selectionMark}>{selected ? '✓' : ''}</Text></View>}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    height: 70, // Fixed height for reliable drag calculations
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 12,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
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
  selection: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  selectionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectionMark: { color: '#fff', fontFamily: 'Heebo_700Bold' },
});
