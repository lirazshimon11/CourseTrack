import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Pressable, Animated, PanResponder, Dimensions, Keyboard,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session, AttendanceStatus } from '../types';
import { formatHebrewDate } from '../lib/dateUtils';

interface Props {
  session: Session | null;
  onClose: () => void;
  onNotesChange: (sessionId: string, notes: string) => Promise<boolean>;
  onStatusChange: (sessionId: string, attendance: AttendanceStatus) => Promise<void>;
  themeColor: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const ATTENDANCE_OPTIONS: { key: AttendanceStatus; label: string; emoji: string }[] = [
  { key: 'attended', label: 'נצפה', emoji: '✅' },
  { key: 'missed', label: 'לא נצפה', emoji: '❌' },
  { key: null, label: 'לא ידוע', emoji: '❓' },
];

export const SessionDetailSheet = ({ session, onClose, onNotesChange, onStatusChange, themeColor }: Props) => {
  const [notes, setNotes] = useState('');
  const [localAttendance, setLocalAttendance] = useState<AttendanceStatus>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [internalVisible, setInternalVisible] = useState(false);

  useEffect(() => {
    if (session) {
      setInternalVisible(true);
      setNotes(session.notes || '');
      setLocalAttendance(session.attendance ?? null);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else if (internalVisible) {
      handleDismiss();
    }
  }, [session]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setInternalVisible(false);
      onClose();
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const lastUpdatedText = useMemo(() => {
    if (!session) return '...';
    try {
      const ts = session.updated_at || session.created_at;
      if (!ts) return '';
      const date = new Date(ts);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year}, ${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  }, [session?.updated_at, session?.created_at]);

  const formattedDate = session ? formatHebrewDate(session.date).full : '';
  const timeRange = session ? `\u200E${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}\u200E` : '';

  if (!session) return null;

  const handleSaveNotes = async () => {
    const success = await onNotesChange(session.id, notes);
    if (success) {
      setShowSuccess(true);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(toastOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
      ]).start(() => setShowSuccess(false));
    }
  };

  const handleAttendancePick = async (key: AttendanceStatus) => {
    setLocalAttendance(key);
    await onStatusChange(session.id, key);
  };

  const hasChanges = notes !== (session.notes || '');

  return (
    <Modal visible={internalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <View style={styles.overlay} {...panResponder.panHandlers}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          {showSuccess && (
            <Animated.View style={[styles.successToast, { opacity: toastOpacity }]}>
              <Text style={styles.successText}>✓ השינויים נשמרו בהצלחה</Text>
            </Animated.View>
          )}

          {/* Gesture indicator */}
          <View style={styles.dragZone}>
            <View style={styles.handleBar} />

            <Pressable onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {session.type === 'lecture' ? 'הרצאה' : 'תרגול'} {session.session_number} – {formattedDate}
                </Text>
                <Text style={styles.timeRange}>{timeRange}</Text>
                <Text style={styles.lastUpdated}>
                  עדכון אחרון: {lastUpdatedText}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.sheetContentWrapper}>
            <View style={styles.content}>

              {/* Notes */}
              <View style={styles.notesHeader}>
                <Text style={styles.sectionTitle}>הערות</Text>
                {hasChanges && (
                  <TouchableOpacity onPress={handleSaveNotes}>
                    <Text style={[styles.saveBtn, { color: themeColor }]}>שמור שינויים</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.notesBox}>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="כתוב הערות כאן..."
                  placeholderTextColor={Colors.textMuted}
                  blurOnSubmit={false}
                />
              </View>

              {/* Attendance Selector */}
              <View style={styles.attendanceRow}>
                {ATTENDANCE_OPTIONS.map(opt => {
                  const isActive = localAttendance === opt.key;
                  return (
                    <TouchableOpacity
                      key={String(opt.key)}
                      style={[
                        styles.attendanceBtn,
                        isActive && {
                          backgroundColor: themeColor + '22',
                          borderColor: themeColor,
                        },
                      ]}
                      onPress={() => handleAttendancePick(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.attendanceEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.attendanceBtnText,
                          isActive && { color: themeColor, fontFamily: 'Heebo_700Bold' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center', // Centers the sheet on large screens (Web)
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: SCREEN_HEIGHT * 0.75,
    width: '100%',
    maxWidth: 500, // Important for web/tablets
    paddingBottom: 40,
    overflow: 'hidden',
  },
  handleBar: {
    width: 60,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  dragZone: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetContentWrapper: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md + 2,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  timeRange: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontFamily: 'Heebo_500Medium',
    marginTop: 2,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  content: { padding: Spacing.md, flex: 1 },

  // Attendance selector
  attendanceRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  attendanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  attendanceEmoji: {
    fontSize: 13,
  },
  attendanceBtnText: {
    fontSize: 12,
    fontFamily: 'Heebo_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Notes
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  saveBtn: {
    fontFamily: 'Heebo_700Bold',
    textAlign: 'left',
    fontSize: FontSize.sm,
  },
  notesBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    minHeight: 100,
    maxHeight: 350,
    color: Colors.text,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    textAlign: 'right',
    paddingTop: 16,
    paddingBottom: 16,
    ...({ outlineStyle: 'none' } as any),
  },
  successToast: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_700Bold',
    textAlign: 'center',
  },
});