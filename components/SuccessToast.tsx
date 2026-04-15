import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';

interface Props {
  visible: boolean;
  message: string;
  onHide: () => void;
}

export const SuccessToast = ({ visible, message, onHide }: Props) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          hide();
        }, 2000);
      });
    }
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 20,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onHide();
    });
  };

  if (!shouldRender) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
  },
  toast: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '44',
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    gap: Spacing.xs,
  },
  icon: { fontSize: 16 },
  text: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: 'Heebo_600SemiBold',
  },
});
