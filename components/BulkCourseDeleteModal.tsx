import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

type Props = { visible: boolean; count: number; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => Promise<void> };
const CONFIRMATION = 'מחק';
export function BulkCourseDeleteModal({ visible, count, busy, error, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState('');
  useEffect(() => { if (visible) setValue(''); }, [visible]);
  const valid = value.trim() === CONFIRMATION;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
    <Pressable style={styles.overlay} onPress={busy ? undefined : onCancel}>
      <Pressable style={styles.card}>
        <Text style={styles.title}>מחיקה לצמיתות</Text>
        <Text style={styles.text}>{count === 1 ? 'הקורס שנבחר' : `${count} הקורסים שנבחרו`} וכל המפגשים, הנוכחות וההערות שלהם יימחקו ממסד הנתונים. לא ניתן לשחזר אותם.</Text>
        <Text style={styles.text}>כדי לאשר, הקלידו בדיוק: {CONFIRMATION}</Text>
        <TextInput accessibilityLabel="אישור מחיקה" editable={!busy} value={value} onChangeText={setValue} autoCapitalize="none" style={styles.input} placeholder={CONFIRMATION} placeholderTextColor={Colors.textMuted} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" disabled={!valid || busy} style={[styles.delete, (!valid || busy) && styles.disabled]} onPress={() => void onConfirm()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>מחיקה לצמיתות</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>ביטול</Text></TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { color: Colors.text, fontFamily: 'Heebo_700Bold', fontSize: FontSize.xl, textAlign: 'right' },
  text: { color: Colors.textSecondary, fontFamily: 'Heebo_400Regular', textAlign: 'right', lineHeight: 23 },
  input: { backgroundColor: Colors.background, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, color: Colors.text, fontFamily: 'Heebo_600SemiBold', fontSize: FontSize.md, padding: Spacing.md, textAlign: 'right' },
  error: { color: '#FCA5A5', fontFamily: 'Heebo_400Regular', textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', gap: Spacing.sm },
  delete: { flex: 1, backgroundColor: Colors.danger, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  deleteText: { color: '#fff', fontFamily: 'Heebo_700Bold' },
  cancel: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontFamily: 'Heebo_600SemiBold' },
});
