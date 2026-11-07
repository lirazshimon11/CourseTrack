import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { COURSE_COLORS } from "../constants/courseColors";
import { Disclosure, ui } from "./SettingsUI";
export function CourseColorPicker({
  color,
  onChange,
  disabled = false,
}: {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const [colors, setColors] = useState(() => [...new Set([...COURSE_COLORS, color])]);
  useEffect(() => {
    setColors((current) => current.includes(color) ? current : [...current, color]);
  }, [color]);
  return (
    <Disclosure title="צבע הקורס · לחצו לשינוי">
      <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
        {colors.map((value) => (
          <TouchableOpacity
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={`צבע ${value}`}
            accessibilityState={{ selected: color === value, disabled }}
            disabled={disabled}
            onPress={() => onChange(value)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: value,
              borderWidth: color === value ? 3 : 0,
              borderColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {color === value && (
              <Text style={{ color: "#fff", fontSize: 20 }}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Disclosure>
  );
}
