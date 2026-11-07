import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { Action, ui } from "./SettingsUI";

export function CalendarRecovery({
  institutionId,
  onRefresh,
}: {
  institutionId: string;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    void supabase.rpc("is_app_admin").then(({ data }) => {
      if (live) setAdmin(data === true);
    });
    return () => {
      live = false;
    };
  }, []);
  const sync = async () => {
    setBusy(true);
    setMessage("");
    try {
      const source = await supabase
        .from("calendar_sources")
        .select("id,enabled")
        .eq("institution_id", institutionId)
        .maybeSingle();
      if (source.error)
        throw new Error("לא ניתן לקרוא את מקור הלוח. בדקו את הרשאות המנהל.");
      if (!source.data?.enabled)
        throw new Error(
          "לא מוגדר מקור שליפה פעיל למוסד. ניתן להגדיר אותו במרכז הניהול.",
        );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/calendar-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ source_id: source.data.id }),
      });
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      )
        throw new Error(
          "שליפה מהמקור זמינה באתר שב־Vercel. שרת Expo המקומי אינו מפעיל את ה־API.",
        );
      const result = await response.json();
      const run = result.results?.[0];
      if (!response.ok)
        throw new Error(result.error ?? run?.message ?? "שליפת הלוח נכשלה.");
      setMessage(
        run?.status === "review"
          ? "השליפה הסתיימה, אך הלוח דורש בדיקה במרכז הניהול."
          : run?.status === "skipped"
            ? run.message
            : "בדיקת המקור הושלמה. מרענן את תאריכי הסמסטר…",
      );
      await onRefresh();
    } catch (e: any) {
      setMessage(e.message ?? "לא ניתן להשלים את השליפה.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <Action
        secondary
        disabled={busy}
        title={busy ? "בודק את הלוח…" : "בדיקת זמינות הלוח מחדש"}
        onPress={async () => {
          setBusy(true);
          try {
            await onRefresh();
          } finally {
            setBusy(false);
          }
        }}
      />
      {admin && (
        <>
          <Action
            disabled={busy}
            title="מנהל · שליפת לוח המוסד עכשיו"
            onPress={sync}
          />
          <Action
            secondary
            disabled={busy}
            title="פתיחת תוצאות הסנכרון בניהול"
            onPress={() => router.push("/admin")}
          />
        </>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={ui.text}>
          {message}
        </Text>
      )}
    </View>
  );
}
