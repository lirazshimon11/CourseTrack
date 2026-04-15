import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Pressable, Animated, PanResponder, Dimensions, ScrollView
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session } from '../types';
import { formatHebrewDate } from '../lib/dateUtils';

interface Props {
  session: Session | null;
  onClose: () => void;
  onNotesChange: (sessionId: string, notes: string) => Promise<void>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const SessionDetailSheet = ({ session, onClose, onNotesChange }: Props) => {
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (session) {
      setNotes(session.notes || '');
      setIsEditing(false);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [session]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!session) return null;

  const handleSaveNotes = async () => {
    await onNotesChange(session.id, notes);
    setIsEditing(false);
  };

  const formattedDate = formatHebrewDate(session.date).full;
  const timeRange = `\u200E${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}\u200E`;

  return (
    <Modal visible={!!session} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View 
          style={[styles.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleBar} />
          
          <View style={styles.header}>
            <Text style={styles.title}>
              {session.type === 'lecture' ? 'הרצאה' : 'תרגול'} {session.session_number} – {formattedDate}
            </Text>
            <Text style={styles.lastUpdated}>
              עדכון אחרון: {new Date(session.updated_at || session.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.notesHeader}>
              <Text style={styles.sectionTitle}>הערות</Text>
              <TouchableOpacity onPress={() => isEditing ? handleSaveNotes() : setIsEditing(true)}>
                <Text style={styles.editBtn}>{isEditing ? 'שמור' : 'ערוך'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.notesBox}>
              {isEditing ? (
                <TextInput
                  style={styles.notesInput}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="הוסף הערות כאן..."
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView style={{ flex: 1 }}>
                    <Text style={styles.notesText}>
                      {session.notes || 'אין הערות למפגש זה.'}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.footerInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>{session.type === 'lecture' ? 'הרצאה' : 'תרגול'}</Text>
                <Text style={styles.infoLabel}>סוג מפגש:</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>{timeRange}</Text>
                <Text style={styles.infoLabel}>שעה:</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoValue, { color: session.attendance === 'attended' ? '#10B981' : session.attendance === 'missed' ? '#EF4444' : Colors.textMuted }]}>
                  {session.attendance === 'attended' ? 'נוכח' : session.attendance === 'missed' ? 'לא נוכח' : 'טרם עודכן'}
                </Text>
                <Text style={styles.infoLabel}>סטטוס נוכחות:</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: SCREEN_HEIGHT * 0.73,
    paddingBottom: 40,
  },
  handleBar: {
    width: 60,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  header: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  title: { fontSize: FontSize.md, fontFamily: 'Heebo_700Bold', color: Colors.text, textAlign: 'center' },
  lastUpdated: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  content: { padding: Spacing.md, flex: 1 },
  notesHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  sectionTitle: { fontSize: FontSize.md, fontFamily: 'Heebo_600SemiBold', color: Colors.textSecondary, textAlign: 'right' },
  editBtn: { color: Colors.primaryLight, fontFamily: 'Heebo_600SemiBold', textAlign: 'left' },
  notesBox: {
    flex: 1,
    minHeight: 150,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    textAlign: 'right',
  },
  notesText: { 
    color: Colors.text, 
    fontSize: FontSize.sm, 
    textAlign: 'left',
    width: '100%',
    writingDirection: 'rtl'
  },
  footerInfo: { marginTop: Spacing.xl, gap: 4 },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.7,
    borderBottomColor: Colors.border + '33',
  },
  infoLabel: { 
    fontSize: FontSize.sm, 
    color: Colors.textMuted, 
    fontFamily: 'Heebo_400Regular', 
    marginLeft: 8,
    textAlign: 'right' 
  },
  infoValue: { fontSize: FontSize.sm, color: Colors.text, fontFamily: 'Heebo_600SemiBold', textAlign: 'right' },
});