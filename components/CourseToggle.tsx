import React, { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, View } from "react-native";

export function CourseToggle({
  enabled,
  color,
  label,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  color: string;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  const position = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(position, {
      toValue: enabled ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [enabled, position]);
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onToggle}
      activeOpacity={0.8}
      style={{
        width: 48,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          backgroundColor: enabled ? color : "#343445",
          borderWidth: 1,
          borderColor: enabled ? color : "#515162",
          direction: "ltr",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            left: 3,
            top: 3,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: enabled ? "#FFFFFF" : "#9494A5",
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 18],
                }),
              },
            ],
          }}
        />
      </View>
    </TouchableOpacity>
  );
}
