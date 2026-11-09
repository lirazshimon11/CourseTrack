import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';

export function BackButton({ onPress, color = Colors.primaryLight, label = 'חזרה' }: { onPress: () => void; color?: string; label?: string }) {
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    style={styles.button}
  >
    <Ionicons name="arrow-forward" size={20} color={color} />
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
});
