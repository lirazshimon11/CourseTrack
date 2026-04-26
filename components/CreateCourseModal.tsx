import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Semester, ScheduleSlot, AcademicYear, Course } from '../types';

type SlotWithoutMeta = Omit<ScheduleSlot, 'id' | 'course_id'>;

interface Props {
  visible: boolean;
  academicYear: AcademicYear | null;
  courseToEdit?: Course | null;
  onClose: () => void;
  onSave: (
    name: string,
    semester: Semester,
    color: string,
    lectureSlots: SlotWithoutMeta[],
    exerciseSlots: SlotWithoutMeta[]
  ) => Promise<{ error?: any; success?: boolean }>;
}

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

const COURSE_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B', // Slate
  '#84CC16', // Lime
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#A855F7', // Purple
  '#78350F', // Brown
  '#334155', // Dark Slate
];

export const CreateCourseModal = ({ visible, academicYear, courseToEdit, onClose, onSave }: Props) => {
  const [name, setName] = useState('');
  const [semester, setSemester] = useState<Semester>('א');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [lectureSlots, setLectureSlots] = useState<SlotWithoutMeta[]>([]);
  const [exerciseSlots, setExerciseSlots] = useState<SlotWithoutMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (courseToEdit) {
        setName(courseToEdit.name);
        setSemester(courseToEdit.semester);
        setColor(courseToEdit.color || COURSE_COLORS[0]);

        if (courseToEdit.slots) {
          // ... mapping logic
          const lectures = courseToEdit.slots
            .filter((s: ScheduleSlot) => s.type === 'lecture')
            .map(({ id, course_id, ...rest }: ScheduleSlot) => ({
              ...rest,
              start_time: rest.start_time.substring(0, 5),
              end_time: rest.end_time.substring(0, 5)
            }));
          const exercises = courseToEdit.slots
            .filter((s: ScheduleSlot) => s.type === 'exercise')
            .map(({ id, course_id, ...rest }: ScheduleSlot) => ({
              ...rest,
              start_time: rest.start_time.substring(0, 5),
              end_time: rest.end_time.substring(0, 5)
            }));

          setLectureSlots(lectures);
          setExerciseSlots(exercises);
        }
      } else {
        setName('');
        setSemester('א');
        setColor(COURSE_COLORS[0]);
        setLectureSlots([{ day_of_week: 0, start_time: '08:00', end_time: '10:00', type: 'lecture' }]);
        setExerciseSlots([]);
      }
    }
  }, [visible, courseToEdit]);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('שגיאה', 'יש להזין שם לקורס');
    setLoading(true);
    const { error } = await onSave(name, semester, color, lectureSlots, exerciseSlots);
    setLoading(false);
    if (error) {
      Alert.alert('שגיאה', 'שמירה נכשלה');
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerAction}>
            <Text style={styles.closeBtn}>ביטול</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{courseToEdit ? 'עריכת קורס' : 'קורס חדש'}</Text>
          <View style={styles.headerAction} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text style={styles.label}>שם הקורס</Text>
              <TextInput 
                style={styles.input} 
                placeholder="לדוגמה: מבוא למדעי המחשב" 
                placeholderTextColor={Colors.text}
                value={name} 
                onChangeText={setName} 
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>צבע הקורס</Text>
              <View style={styles.colorRow}>
                {COURSE_COLORS.map((c) => (
                  <TouchableOpacity 
                    key={c} 
                    style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorCircleActive]} 
                    onPress={() => setColor(c)}
                  >
                    {color === c && <View style={styles.colorInnerCircle} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>סמסטר</Text>
              <View style={styles.row}>
                {(['א', 'ב', 'קיץ'] as Semester[]).map((s) => (
                  <TouchableOpacity key={s} style={[styles.chip, semester === s && styles.chipActive]} onPress={() => setSemester(s)}>
                    <Text style={[styles.chipText, semester === s && styles.chipTextActive]}>סמסטר {s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <TouchableOpacity onPress={() => setLectureSlots([...lectureSlots, { day_of_week: 0, start_time: '08:00', end_time: '10:00', type: 'lecture' }])}>
                  <Text style={styles.addBtn}>+ הוסף הרצאה</Text>
                </TouchableOpacity>
                <Text style={styles.label}>זמני הרצאות</Text>
              </View>
              {lectureSlots.map((slot, idx) => (
                <SlotRow
                  key={idx} slot={slot}
                  onUpdate={(u: Partial<SlotWithoutMeta>) => setLectureSlots(lectureSlots.map((s, i) => i === idx ? { ...s, ...u } : s))}
                  onRemove={() => setLectureSlots(lectureSlots.filter((_, i) => i !== idx))}
                />
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <TouchableOpacity onPress={() => setExerciseSlots([...exerciseSlots, { day_of_week: 0, start_time: '08:00', end_time: '10:00', type: 'exercise' }])}>
                  <Text style={styles.addBtn}>+ הוסף תרגול</Text>
                </TouchableOpacity>
                <Text style={styles.label}>זמני תרגולים</Text>
              </View>
              {exerciseSlots.map((slot, idx) => (
                <SlotRow
                  key={idx} slot={slot}
                  onUpdate={(u: Partial<SlotWithoutMeta>) => setExerciseSlots(exerciseSlots.map((s, i) => i === idx ? { ...s, ...u } : s))}
                  onRemove={() => setExerciseSlots(exerciseSlots.filter((_, i) => i !== idx))}
                />
              ))}
            </View>
            <View style={{ height: 100 }} />
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
              <Text style={styles.saveBtnText}>{loading ? 'שומר...' : (courseToEdit ? 'שמור שינויים' : 'צור קורס')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const SlotRow = ({ slot, onUpdate, onRemove }: any) => (
  <View style={styles.slotRow}>
    <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
      <Text style={styles.removeBtnText}>✕</Text>
    </TouchableOpacity>
    <View style={styles.slotMain}>
      <View style={styles.timeInputsRow}>
        <TextInput style={styles.timeInput} value={slot.end_time} onChangeText={(t) => onUpdate({ end_time: t })} placeholder="10:00" />
        <Text style={styles.dash}>-</Text>
        <TextInput style={styles.timeInput} value={slot.start_time} onChangeText={(t) => onUpdate({ start_time: t })} placeholder="08:00" />
      </View>
      <View style={styles.daysRow}>
        {DAYS.map((day, idx) => (
          <TouchableOpacity key={day} style={[styles.dayChip, slot.day_of_week === idx && styles.dayChipActive]} onPress={() => onUpdate({ day_of_week: idx })}>
            <Text style={[styles.dayText, slot.day_of_week === idx && styles.dayTextActive]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  headerAction: { width: 60 },
  title: { fontSize: FontSize.lg, fontFamily: 'Heebo_700Bold', color: Colors.text, flex: 1, textAlign: 'center' },
  closeBtn: { color: Colors.primaryLight, fontSize: FontSize.md, fontFamily: 'Heebo_600SemiBold' },
  content: { padding: Spacing.md },
  section: { marginBottom: Spacing.xl },
  label: { fontSize: FontSize.md, fontFamily: 'Heebo_600SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm, textAlign: 'right' },
  input: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md, fontFamily: 'Heebo_400Regular', borderWidth: 1, borderColor: Colors.border, textAlign: 'right' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  colorCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorCircleActive: { transform: [{ scale: 1.1 }], borderWidth: 2, borderColor: '#fff' },
  colorInnerCircle: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  rowBetween: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  chip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontFamily: 'Heebo_500Medium' },
  chipTextActive: { color: '#fff', fontFamily: 'Heebo_700Bold' },
  addBtn: { color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold', fontSize: FontSize.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  removeBtn: { padding: 8, marginRight: 8 },
  removeBtnText: { color: Colors.danger, fontSize: 18, fontWeight: 'bold' },
  slotMain: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  timeInputsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 4, height: 38, color: Colors.text, width: 55, textAlign: 'center', fontSize: 15 },
  dash: { color: Colors.textMuted },
  daysRow: { flexDirection: 'row', gap: 3 },
  dayChip: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: 12, color: Colors.textMuted },
  dayTextActive: { color: '#fff', fontWeight: 'bold' },
  footer: { padding: Spacing.md, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.lg, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: FontSize.lg, fontFamily: 'Heebo_700Bold' },
});
