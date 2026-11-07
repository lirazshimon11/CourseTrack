import React, { useState } from "react";
import { Text, View } from "react-native";
import { Action, ui } from "./SettingsUI";

// Personal recovery is identical for every account. Source synchronization lives in /admin.
export function CalendarRecovery({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <View style={{ gap: 10 }}>
      <Action
        secondary
        disabled={busy}
        title={busy ? "בודק את הלוח…" : "בדיקת זמינות הלוח מחדש"}
        onPress={async () => {
          setBusy(true);
          setMessage("");
          try {
            await onRefresh();
          } catch {
            setMessage("לא ניתן לבדוק את הלוח כרגע. נסו שוב.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {!!message && <Text accessibilityRole="alert" style={ui.text}>{message}</Text>}
    </View>
  );
}
