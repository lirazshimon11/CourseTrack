import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { AcademicYear } from '../types';

interface AcademicYearModalProps {
  visible: boolean;
  current: AcademicYear | null;
  onClose: () => void;
  onSave: (data: Omit<AcademicYear, 'id' | 'created_at'>) => Promise<{ error: any }>;
}

const FIELDS = [
  { key: 'semester_a_start', label: "סמסטר א' – התחלה", placeholder: 'DD.MM.YYYY' },
  { key: 'semester_a_end',   label: "סמסטר א' – סיום",   placeholder: 'DD.MM.YYYY' },
  { key: 'semester_b_start', label: "סמסטר ב' – התחלה", placeholder: 'DD.MM.YYYY' },
  { key: 'semester_b_end',   label: "סמסטר ב' – סיום",   placeholder: 'DD.MM.YYYY' },
  { key: 'semester_c_start', label: "סמסטר ג' – התחלה", placeholder: 'DD.MM.YYYY' },
  { key: 'semester_c_end',   label: "סמסטר ג' – סיום",   placeholder: 'DD.MM.YYYY' },
] as const;

function parseDDMMYYYY(str: string): string | null {
  const match = str.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function formatToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function AcademicYearModal({ visible, current, onClose, onSave }: AcademicYearModalProps) {
  const [label, setLabel] = useState(current?.label ?? '2025-2026');
  const [fields, setFields] = useState({
    semester_a_start: formatToDisplay(current?.semester_a_start),
    semester_a_end:   formatToDisplay(current?.semester_a_end),
    semester_b_start: formatToDisplay(current?.semester_b_start),
    semester_b_end:   formatToDisplay(current?.semester_b_end),
    semester_c_start: formatToDisplay(current?.semester_c_start),
    semester_c_end:   formatToDisplay(current?.semester_c_end),
  });
  const [saving, setSaving] = useState(false);

  // Sync when modal opens with existing data
  React.useEffect(() => {
    if (visible) {
      setLabel(current?.label ?? '2025-2026');
      setFields({
        semester_a_start: formatToDisplay(current?.semester_a_start),
        semester_a_end:   formatToDisplay(current?.semester_a_end),
        semester_b_start: formatToDisplay(current?.semester_b_start),
        semester_b_end:   formatToDisplay(current?.semester_b_end),
        semester_c_start: formatToDisplay(current?.semester_c_start),
        semester_c_end:   formatToDisplay(current?.semester_c_end),
      });
    }
  }, [visible, current]);

  const handleSave = async () => {
    setSaving(true);
    const parsed: any = { label };
    for (const f of FIELDS) {
      const val = fields[f.key];
      if (val) {
        const iso = parseDDMMYYYY(val);
        if (!iso) {
          Alert.alert('שגיאה', `הפורמט של "${f.label}" שגוי. השתמש ב-DD.MM.YYYY`);
          setSaving(false);
          return;
        }
        parsed[f.key] = iso;
      } else {
        parsed[f.key] = null;
      }
    }
    const { error } = await onSave(parsed);
    setSaving(false);
    if (error) Alert.alert('שגיאה', `שמירה נכשלה: ${error.message || 'שגיאה לא ידועה'}`);
    else onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>ביטול</Text>
          </TouchableOpacity>
          <Text style={styles.title}>הגדרות שנה אקדמית</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.save}>שמור</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>שם השנה</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="לדוגמה: 2025-2026"
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
          />

          {FIELDS.map(f => (
            <View key={f.key}>
              <Text style={styles.sectionLabel}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={fields[f.key]}
                onChangeText={v => setFields(prev => ({ ...prev, [f.key]: v }))}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="numbers-and-punctuation"
                textAlign="right"
              />
            </View>
          ))}

          <View style={styles.hint}>
            <Text style={styles.hintText}>
              פורמט התאריכים: DD.MM.YYYY{'\n'}
              לדוגמה: 02.11.2025
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
  },
  cancel: { fontSize: FontSize.md, color: Colors.textSecondary, fontFamily: 'Heebo_400Regular' },
  save: { fontSize: FontSize.md, color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold' },
  body: { padding: Spacing.md, gap: Spacing.xs },
  sectionLabel: {
    fontSize: FontSize.sm, fontFamily: 'Heebo_600SemiBold',
    color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.sm,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: 'Heebo_400Regular',
  },
  hint: {
    backgroundColor: Colors.glassLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  hintText: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
  },
});
