import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Dimensions, Modal } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Course } from '../types';

interface Props {
  course: Course | null;
  position: { x: number, y: number } | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (courseId: string) => void;
  onEdit: (course: Course) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const CourseActionMenu = ({ course, position, visible, onClose, onDelete, onEdit }: Props) => {
  if (!visible || !course || !position) return null;

  const menuWidth = 180;
  const menuHeight = 110;
  
  const pivotX = position.x;
  const pivotY = position.y;
  
  let left = pivotX - 90;
  if (left + menuWidth > SCREEN_WIDTH - 20) left = SCREEN_WIDTH - menuWidth - 20;
  if (left < 20) left = 20;

  let top = pivotY + 20; 
  if (top + menuHeight > SCREEN_HEIGHT - 50) top = pivotY - menuHeight - 20;
  if (top < 50) top = 50;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlayRoot} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.menuCard, { top, left, width: menuWidth }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onEdit(course); }}>
            <Text style={styles.menuItemText}>עריכה</Text>
            <Text style={styles.menuItemIcon}>✏️</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onDelete(course.id); }}>
            <Text style={[styles.menuItemText, styles.deleteText]}>מחיקה</Text>
            <Text style={[styles.menuItemIcon, styles.deleteText]}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    // FORCE LTR to make 'left: pivotX' absolute from screen edge
    direction: 'ltr',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menuCard: {
    position: 'absolute',
    width: 180,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
    // Content inside stays RTL for Hebrew
    direction: 'rtl',
    // On web, we need to ensure it stays within the phone-sized container
    // but pivot coordinates are likely window-based.
    // If it's problematic, we might need to adjust 'left'.
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemIcon: { fontSize: 16 },
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Heebo_600SemiBold',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  deleteText: {
    color: Colors.danger,
  },
});
