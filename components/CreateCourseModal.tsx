import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize, HEBREW_DAYS, SEMESTERS } from '../constants/theme';
import { Semester, ScheduleSlot, AcademicYear } from '../types';

interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface CreateCourseModalProps {
  visible: boolean;
  academicYear: AcademicYear | null;
  onClose: () => void;
  onSave: (
    name: string,
    semester: Semester,
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[]
  ) => Promise<{ error: any }>;
}

const DEFAULT_SLOT: SlotInput = { day_of_week: 0, start_time: '', end_time: '' };

function DayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
      {HEBREW_DAYS.map((day, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.dayBtn, value === i && styles.dayBtnActive]}
          onPress={() => onChange(i)}
        >
          <Text style={[styles.dayBtnText, value === i && styles.dayBtnTextActive]}>{day}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SlotEditor({
  slot, index, onUpdate, onRemove, canRemove, label,
}: {
  slot: SlotInput;
  index: number;
  onUpdate: (i: number, s: SlotInput) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
  label: string;
}) {
  return (
    <View style={styles.slotBox}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotLabel}>{label} {index + 1}</Text>
        {canRemove && (
          <TouchableOpacity onPress={() => onRemove(index)}>
            <Text style={styles.removeBtn}>הסר</Text>
          </TouchableOpacity>
        )}
      </View>
      <DayPicker value={slot.day_of_week} onChange={d => onUpdate(index, { ...slot, day_of_week: d })} />
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="09:00"
          placeholderTextColor={Colors.textMuted}
          value={slot.start_time}
          onChangeText={v => onUpdate(index, { ...slot, start_time: v })}
          keyboardType="numbers-and-punctuation"
          textAlign="center"
        />
        <Text style={styles.timeSep}>–</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="12:00"
          placeholderTextColor={Colors.textMuted}
          value={slot.end_time}
          onChangeText={v => onUpdate(index, { ...slot, end_time: v })}
          keyboardType="numbers-and-punctuation"
          textAlign="center"
        />
      </View>
    </View>
  );
}

function parseTime(t: string): string {
  const clean = t.trim().replace('.', ':');
  if (!clean.includes(':')) return clean + ':00';
  return clean;
}

export function CreateCourseModal({ visible, academicYear, onClose, onSave }: CreateCourseModalProps) {
  const [name, setName] = useState('');
  const [semester, setSemester] = useState<Semester>('א');
  const [lectureSlots, setLectureSlots] = useState<SlotInput[]>([{ ...DEFAULT_SLOT }]);
  const [exerciseSlots, setExerciseSlots] = useState<SlotInput[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setSemester('א');
    setLectureSlots([{ ...DEFAULT_SLOT }]);
    setExerciseSlots([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const updateSlot = (list: SlotInput[], setList: React.Dispatch<React.SetStateAction<SlotInput[]>>, i: number, s: SlotInput) => {
    const copy = [...list];
    copy[i] = s;
    setList(copy);
  };

  const removeSlot = (list: SlotInput[], setList: React.Dispatch<React.SetStateAction<SlotInput[]>>, i: number) => {
    setList(list.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('שגיאה', 'יש להזין שם קורס'); return; }
    if (!academicYear) { Alert.alert('שגיאה', 'יש להגדיר שנה אקדמית קודם'); return; }
    if (lectureSlots.length === 0) { Alert.alert('שגיאה', 'יש להוסיף לפחות מפגש הרצאה אחד'); return; }

    setSaving(true);
    try {
      const toSlot = (s: SlotInput, type: 'lecture' | 'exercise') => ({
        type,
        day_of_week: s.day_of_week,
        start_time: parseTime(s.start_time) || '09:00',
        end_time: parseTime(s.end_time) || '10:00',
      });

      const lecture = lectureSlots.map(s => toSlot(s, 'lecture'));
      const exercise = exerciseSlots.map(s => toSlot(s, 'exercise'));

      const { error } = await onSave(name.trim(), semester, lecture, exercise);
      if (error) { Alert.alert('שגיאה', 'שמירה נכשלה. נסה שוב.'); }
      else { reset(); onClose(); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}><Text style={styles.cancel}>ביטול</Text></TouchableOpacity>
          <Text style={styles.title}>קורס חדש</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={styles.save}>צור קורס</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Course name */}
          <Text style={styles.label}>שם הקורס</Text>
          <TextInput
            style={styles.input}
            placeholder="לדוגמה: אינפי 3"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            textAlign="right"
          />

          {/* Semester */}
          <Text style={styles.label}>סמסטר</Text>
          <View style={styles.semesterRow}>
            {SEMESTERS.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.semesterBtn, semester === s.value && styles.semesterBtnActive]}
                onPress={() => setSemester(s.value as Semester)}
              >
                <Text style={[styles.semesterBtnText, semester === s.value && styles.semesterBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lecture slots */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎓 הרצאות</Text>
          </View>
          {lectureSlots.map((slot, i) => (
            <SlotEditor
              key={i} slot={slot} index={i} label="הרצאה"
              onUpdate={(idx, s) => updateSlot(lectureSlots, setLectureSlots, idx, s)}
              onRemove={(idx) => removeSlot(lectureSlots, setLectureSlots, idx)}
              canRemove={lectureSlots.length > 1}
            />
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setLectureSlots([...lectureSlots, { ...DEFAULT_SLOT }])}>
            <Text style={styles.addBtnText}>+ הוסף הרצאה נוספת</Text>
          </TouchableOpacity>

          {/* Exercise slots */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📚 תרגולים (אופציונלי)</Text>
          </View>
          {exerciseSlots.map((slot, i) => (
            <SlotEditor
              key={i} slot={slot} index={i} label="תרגול"
              onUpdate={(idx, s) => updateSlot(exerciseSlots, setExerciseSlots, idx, s)}
              onRemove={(idx) => removeSlot(exerciseSlots, setExerciseSlots, idx)}
              canRemove={true}
            />
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setExerciseSlots([...exerciseSlots, { ...DEFAULT_SLOT }])}>
            <Text style={styles.addBtnText}>+ הוסף תרגול</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: Spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontFamily: 'Heebo_700Bold', color: Colors.text },
  cancel: { fontSize: FontSize.md, color: Colors.textSecondary, fontFamily: 'Heebo_400Regular' },
  save: { fontSize: FontSize.md, color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold' },
  body: { padding: Spacing.md },
  label: { fontSize: FontSize.sm, fontFamily: 'Heebo_600SemiBold', color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.md, textAlign: 'left' },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.text,
    fontSize: FontSize.md, fontFamily: 'Heebo_400Regular',
  },
  semesterRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, alignItems: 'center' },
  semesterBtn: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  semesterBtnActive: { backgroundColor: Colors.primary + '33', borderColor: Colors.primary },
  semesterBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'Heebo_500Medium' },
  semesterBtnTextActive: { color: Colors.primaryLight, fontFamily: 'Heebo_700Bold' },
  sectionHeader: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontFamily: 'Heebo_700Bold', color: Colors.text, textAlign: 'left' },
  slotBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  slotLabel: { fontSize: FontSize.sm, fontFamily: 'Heebo_600SemiBold', color: Colors.text },
  removeBtn: { fontSize: FontSize.sm, color: Colors.danger, fontFamily: 'Heebo_500Medium' },
  dayRow: { flexDirection: 'row', gap: 4, paddingBottom: Spacing.sm },
  dayBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  dayBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: 'Heebo_500Medium' },
  dayBtnTextActive: { color: Colors.text, fontFamily: 'Heebo_700Bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  timeInput: { flex: 1, textAlign: 'center' },
  timeSep: { color: Colors.textMuted, fontSize: FontSize.lg },
  addBtn: {
    borderWidth: 1, borderColor: Colors.primary + '55', borderStyle: 'dashed',
    borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center',
  },
  addBtnText: { color: Colors.primaryLight, fontSize: FontSize.sm, fontFamily: 'Heebo_500Medium' },
});
