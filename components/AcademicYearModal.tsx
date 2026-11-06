import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { AcademicYear } from '../types';

interface AcademicYearModalProps {
  title?: string;
  initialLabel?: string;
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
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function formatToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function defaultYearLabel() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function AcademicYearModal({ visible, current, onClose, onSave, title = 'הגדרות שנה אקדמית', initialLabel }: AcademicYearModalProps) {
  const [label, setLabel] = useState(current?.label ?? defaultYearLabel());
  const [fields, setFields] = useState({
    semester_a_start: formatToDisplay(current?.semester_a_start),
    semester_a_end:   formatToDisplay(current?.semester_a_end),
    semester_b_start: formatToDisplay(current?.semester_b_start),
    semester_b_end:   formatToDisplay(current?.semester_b_end),
    semester_c_start: formatToDisplay(current?.semester_c_start),
    semester_c_end:   formatToDisplay(current?.semester_c_end),
  });
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [excluded, setExcluded] = useState('');

  // Sync when modal opens with existing data
  React.useEffect(() => {
    if (visible) {
      setErrorText('');
      setExcluded((current?.excluded_dates ?? []).map(formatToDisplay).join('\n'));
      setExpanded(Boolean(current?.semester_b_start || current?.semester_c_start));
      setLabel(current?.label ?? initialLabel ?? defaultYearLabel());
      setFields({
        semester_a_start: formatToDisplay(current?.semester_a_start),
        semester_a_end:   formatToDisplay(current?.semester_a_end),
        semester_b_start: formatToDisplay(current?.semester_b_start),
        semester_b_end:   formatToDisplay(current?.semester_b_end),
        semester_c_start: formatToDisplay(current?.semester_c_start),
        semester_c_end:   formatToDisplay(current?.semester_c_end),
      });
    }
  }, [visible, current, initialLabel]);

  const handleSave = async () => {
    setErrorText('');
    if (!label.trim()) { setErrorText('צריך לתת שם לשנת הלימודים.'); return; }
    setSaving(true);
    const parsed: any = { label: label.trim(), excluded_dates: [] };
    for (const item of excluded.split(/[\n,]/).map(v => v.trim()).filter(Boolean)) {
      const date = parseDDMMYYYY(item);
      if (!date) { setErrorText('תאריך יום ללא לימודים אינו תקין. השתמשו ב־DD.MM.YYYY'); setSaving(false); return; }
      parsed.excluded_dates.push(date);
    }
    parsed.excluded_dates = [...new Set(parsed.excluded_dates)].sort();
    for (const f of FIELDS) {
      const val = fields[f.key];
      if (val) {
        const iso = parseDDMMYYYY(val);
        if (!iso) {
          setErrorText(`התאריך של "${f.label}" אינו תקין. השתמשו ב-DD.MM.YYYY`);
          setSaving(false);
          return;
        }
        parsed[f.key] = iso;
      } else {
        parsed[f.key] = null;
      }
    }
    for (const semester of ['a', 'b', 'c']) {
      const start = parsed[`semester_${semester}_start`];
      const end = parsed[`semester_${semester}_end`];
      if ((start && !end) || (!start && end) || (start && end && start > end)) {
        setErrorText('לכל סמסטר צריך תאריך התחלה ותאריך סיום מאוחר ממנו.'); setSaving(false); return;
      }
    }
    if (!parsed.semester_a_start && !parsed.semester_b_start && !parsed.semester_c_start) {
      setErrorText('מגדירים לפחות סמסטר אחד כדי להתחיל.'); setSaving(false); return;
    }
    try {
      const { error } = await onSave(parsed);
      if (error) setErrorText('השמירה נכשלה. נסו שוב בעוד רגע.');
      else onClose();
    } catch { setErrorText('לא ניתן לשמור כרגע. בדקו את חיבור האינטרנט.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Text style={styles.cancel}>ביטול</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.save}>שמור</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>שם השנה</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="לדוגמה: 2025-2026"
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
          />

          <Text style={styles.hintText}>אפשר להתחיל מסמסטר אחד בלבד ולהוסיף את היתר בהמשך.</Text>
          {FIELDS.filter((_, index) => expanded || index < 2).map(f => (
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

          <TouchableOpacity onPress={() => setExpanded(!expanded)}><Text style={[styles.save, { textAlign: 'right', marginTop: 16 }]}>{expanded ? 'הסתרת סמסטרים נוספים' : '+ הוספת סמסטר ב׳ / קיץ'}</Text></TouchableOpacity>
          {!!errorText && <Text accessibilityRole="alert" style={[styles.hintText, { color: Colors.danger, marginTop: 12 }]}>{errorText}</Text>}
          <Text style={styles.sectionLabel}>ימים ללא לימודים (לא חובה)</Text>
          <TextInput accessibilityLabel="ימים ללא לימודים" multiline style={[styles.input, { minHeight: 90 }]} value={excluded} onChangeText={setExcluded} placeholder="תאריך בכל שורה, למשל 01.01.2027" placeholderTextColor={Colors.textMuted} textAlign="right" />
          <Text style={styles.hintText}>יחול על יצירת מפגשים חדשים בלבד. מפגשים קיימים לא משתנים.</Text>
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              פורמט התאריכים: DD.MM.YYYY{'\n'}
              לדוגמה: 02.11.2025
            </Text>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#000000' : Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: { 
    flex: 1, 
    backgroundColor: Colors.background,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#333',
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 50,
      }
    })
  },
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
