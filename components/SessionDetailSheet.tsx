import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session, AttendanceStatus } from '../types';

interface Props {
  session: Session | null;
  onClose: () => void;
  onAttendanceChange: (sessionId: string, status: AttendanceStatus) => void;
  onNotesChange: (sessionId: string, notes: string) => void;
}

export const SessionDetailSheet = ({ session, onClose, onAttendanceChange, onNotesChange }: Props) => {
  const [notes, setNotes] = useState(session?.notes || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (session) {
      setNotes(session.notes || '');
      setIsEditing(false);
    }
  }, [session]);

  if (!session) return null;

  const handleSaveNotes = () => {
    onNotesChange(session.id, notes);
    setIsEditing(false);
  };

  return (
    <Modal
      visible={!!session}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>סגור</Text>
            </TouchableOpacity>
            <Text style={styles.title}>פרטי מפגש</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>סטטוס צפייה</Text>
              <View style={styles.statusRow}>
                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    session.attendance === 'attended' && styles.statusBtnAttended
                  ]}
                  onPress={() => onAttendanceChange(session.id, 'attended')}
                >
                  <Text style={[styles.statusBtnText, session.attendance === 'attended' && styles.statusBtnTextActive]}>
                    נצפה ✅
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    session.attendance === 'missed' && styles.statusBtnMissed
                  ]}
                  onPress={() => onAttendanceChange(session.id, 'missed')}
                >
                  <Text style={[styles.statusBtnText, session.attendance === 'missed' && styles.statusBtnTextActive]}>
                    לא נצפה ❌
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    session.attendance === 'none' && styles.statusBtnNone
                  ]}
                  onPress={() => onAttendanceChange(session.id, 'none')}
                >
                  <Text style={[styles.statusBtnText, session.attendance === 'none' && styles.statusBtnTextActive]}>
                    טרם נצפה
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                {isEditing ? (
                  <TouchableOpacity onPress={handleSaveNotes} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>שמור</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Text style={styles.editBtnText}>ערוך</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.label}>הערות</Text>
              </View>

              <TextInput
                style={[styles.notesInput, isEditing && styles.notesInputActive]}
                multiline
                placeholder="הוסף הערות כאן..."
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                editable={isEditing}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>תאריך: {new Date(session.date).toLocaleDateString('he-IL')}</Text>
              <Text style={styles.infoText}>סוג: {session.type === 'lecture' ? 'הרצאה' : 'תרגול'}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: '70%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { padding: Spacing.xs },
  closeText: { color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold', fontSize: FontSize.md },
  title: { fontSize: FontSize.lg, fontFamily: 'Heebo_700Bold', color: Colors.text },
  content: { padding: Spacing.md },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  label: { fontSize: FontSize.md, fontFamily: 'Heebo_600SemiBold', color: Colors.textMuted, textAlign: 'left' },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statusBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBtnText: { color: Colors.textMuted, fontFamily: 'Heebo_500Medium', fontSize: FontSize.sm },
  statusBtnTextActive: { color: '#fff', fontFamily: 'Heebo_700Bold' },
  statusBtnAttended: { backgroundColor: Colors.lectureColor, borderColor: Colors.lectureColor },
  statusBtnMissed: { backgroundColor: Colors.exerciseColor, borderColor: Colors.exerciseColor },
  statusBtnNone: { backgroundColor: Colors.textMuted, borderColor: Colors.textMuted },
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    height: 150,
    color: Colors.text,
    fontFamily: 'Heebo_400Regular',
    fontSize: FontSize.md,
    textAlign: 'left',
  },
  notesInputActive: {
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.sm },
  saveBtnText: { color: '#fff', fontFamily: 'Heebo_600SemiBold' },
  editBtnText: { color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold' },
  infoBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.md },
  infoText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'left', marginBottom: 4 },
});
