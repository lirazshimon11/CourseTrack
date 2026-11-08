import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "../constants/theme";
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: 20, gap: 18, paddingBottom: 48 },
  header: {
    padding: 20,
    direction: "ltr",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: "Heebo_700Bold",
    fontSize: 24,
    color: Colors.text,
    textAlign: "right",
  },
  subtitle: {
    fontFamily: "Heebo_600SemiBold",
    fontSize: 17,
    color: Colors.text,
    textAlign: "right",
  },
  text: {
    fontFamily: "Heebo_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "right",
    lineHeight: 23,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.background,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: "Heebo_400Regular",
    textAlign: "right",
  },
  button: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontFamily: "Heebo_600SemiBold",
    textAlign: "center",
  },
  row: {
    direction: "ltr",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
});
export function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={ui.root}>
      <View style={ui.header}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
        >
          <Text style={{ color: "#C4B5FD" }}>→ חזרה</Text>
        </TouchableOpacity>
        <Text style={ui.title}>{title}</Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.body}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Action({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        ui.button,
        secondary && { backgroundColor: Colors.surface },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={ui.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}
export function Badge({
  text,
  manual = false,
}: {
  text: string;
  manual?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-end",
        backgroundColor: manual ? "#392D1C" : "#123831",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
      }}
    >
      <Text
        style={{
          color: manual ? "#FCD34D" : "#6EE7B7",
          fontFamily: "Heebo_500Medium",
          fontSize: 12,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
export function Disclosure({
  title,
  children,
  initial = false,
}: {
  title: string;
  children: React.ReactNode;
  initial?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <View style={ui.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          direction: "ltr",
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ color: Colors.textSecondary }}>{open ? "−" : "+"}</Text>
        <Text style={[ui.subtitle, { flex: 1 }]}>{title}</Text>
      </TouchableOpacity>
      {open && children}
    </View>
  );
}
export function CalendarSummary({ calendar }: { calendar: any }) {
  const format = (d: string) => d.split("-").reverse().join(".");
  return (
    <View style={{ gap: 8 }}>
      {["a", "b", "c"].map((key, i) => (
        <View
          key={key}
          style={{
            direction: "ltr",
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            backgroundColor: Colors.background,
            padding: 12,
            borderRadius: 10,
            gap: 10,
          }}
        >
          <Text style={ui.text}>{["סמסטר א׳", "סמסטר ב׳", "קיץ"][i]}</Text>
          <Text style={[ui.text, { fontSize: 12 }]}>
            {calendar[`semester_${key}_start`] &&
            calendar[`semester_${key}_end`]
              ? `${format(calendar[`semester_${key}_start`])} – ${format(calendar[`semester_${key}_end`])}`
              : "לא הוגדר"}
          </Text>
        </View>
      ))}
    </View>
  );
}
