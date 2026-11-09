import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export const ConfirmModal = ({ 
  visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, isDestructive = false, confirmDisabled = false, children
}: Props) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {children}
          
          <View style={styles.actions}>
            <TouchableOpacity 
              disabled={confirmDisabled}
              style={[styles.btn, isDestructive ? styles.destructiveBtn : styles.confirmBtn, confirmDisabled && { opacity: 0.45 }]} 
              onPress={onConfirm}
            >
              <Text style={styles.btnText}>{confirmLabel}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  content: { alignItems: 'center' },
  title: {
    fontSize: FontSize.xl,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row-reverse',
    width: '100%',
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  destructiveBtn: {
    backgroundColor: Colors.danger,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: 'Heebo_700Bold',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontFamily: 'Heebo_600SemiBold',
  },
});
