import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

type Props = {
  visible: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCreate: () => void;
  onImport: () => void;
  onDelete: () => void;
};

export function HomeActionsModal({ visible, canDelete, onClose, onCreate, onImport, onDelete }: Props) {
  const action = (callback: () => void) => { onClose(); callback(); };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.card}>
        <Text style={styles.title}>מה תרצו לעשות?</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={() => action(onCreate)}>
          <Text style={styles.primaryText}>＋ יצירת קורס בודד</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => action(onImport)}>
          <Text style={styles.actionText}>↥ ייבוא מערכת שעות</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={!canDelete} style={[styles.action, styles.delete, !canDelete && styles.disabled]} onPress={() => action(onDelete)}>
          <Text style={styles.deleteText}>בחירת קורסים למחיקה</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onClose}><Text style={styles.cancel}>ביטול</Text></TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end', padding: Spacing.md },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, gap: Spacing.xs, maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { color: Colors.text, fontFamily: 'Heebo_700Bold', fontSize: FontSize.xl, textAlign: 'right' },
  primary: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontFamily: 'Heebo_700Bold', fontSize: FontSize.md },
  action: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, alignItems: 'center' },
  actionText: { color: Colors.text, fontFamily: 'Heebo_600SemiBold', fontSize: FontSize.md },
  delete: { borderColor: '#7F1D1D' },
  deleteText: { color: '#FCA5A5', fontFamily: 'Heebo_600SemiBold', fontSize: FontSize.md },
  disabled: { opacity: 0.45 },
  cancel: { color: Colors.textSecondary, fontFamily: 'Heebo_600SemiBold', textAlign: 'center', padding: Spacing.xs },
});
