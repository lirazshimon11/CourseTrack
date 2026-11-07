import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAcademicYear } from "../hooks/useAcademicYear";
import { useCourses } from "../hooks/useCourses";
import { ConfirmModal } from "../components/ConfirmModal";
import { Page, ui, Action, Badge, Disclosure } from "../components/SettingsUI";
export default function SettingsScreen() {
  const router = useRouter();
  const { academicYear, loading: yearLoading } = useAcademicYear();
  const [institution, setInstitution] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [institutionLoading, setInstitutionLoading] = useState(true);
  const [institutionError, setInstitutionError] = useState(false);
  const { deleteAllData } = useCourses();
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setInstitutionLoading(true);
      setInstitutionError(false);
      void (async () => {
        try {
          const profile = await supabase
            .from("student_profiles")
            .select("institution_id")
            .maybeSingle();
          if (profile.error) throw profile.error;
          if (!profile.data?.institution_id) {
            if (active) setInstitution(null);
            return;
          }
          const result = await supabase
            .from("institutions")
            .select("id,name")
            .eq("id", profile.data.institution_id)
            .single();
          if (result.error) throw result.error;
          if (active) setInstitution(result.data);
        } catch {
          if (active) setInstitutionError(true);
        } finally {
          if (active) setInstitutionLoading(false);
        }
      })();
      void supabase.auth
        .getUser()
        .then(({ data }) => setEmail(data.user?.email ?? ""));
      void supabase
        .rpc("is_app_admin")
        .then(({ data }) => setAdmin(data === true));
      return () => {
        active = false;
      };
    }, []),
  );
  const institutionYear =
    institution && academicYear?.institution_id === institution.id
      ? academicYear
      : null;
  const remove = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      await deleteAllData();
      setMessage("הקורסים נמחקו. הגדרות הלימודים נשמרו.");
    } catch {
      setMessage("המחיקה נכשלה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="הגדרות">
      <View
        style={[
          ui.card,
          { backgroundColor: "#281D46", borderColor: "#6540A1" },
        ]}
      >
        <Text style={ui.subtitle}>כל הסמסטר, בייבוא אחד</Text>
        <Text style={ui.text}>
          קובץ מערכת השעות שלך הופך לקורסים ולמפגשים. בודקים את התוצאה לפני
          ששומרים.
        </Text>
        <Action
          title="ייבוא מערכת שעות מ־PDF"
          onPress={() => router.push("/import")}
        />
      </View>
      <Text style={ui.subtitle}>הלימודים שלי</Text>
      <View style={ui.card}>
        {!institutionLoading && !institutionError && institution && (
          <Badge
            text={
              yearLoading
                ? "טוען את לוח הלימודים…"
                : !institutionYear
                  ? "המוסד נבחר · הלוח עדיין לא זמין"
                  : institutionYear.date_mode === "calendar"
                    ? "מתעדכן מלוח המוסד"
                    : "תאריכים בהתאמה אישית"
            }
            manual={!!institutionYear && institutionYear.date_mode === "manual"}
          />
        )}
        <Text style={ui.subtitle}>
          {institutionLoading
            ? "טוען את מוסד הלימודים…"
            : institutionError
              ? "לא ניתן לטעון את המוסד שנשמר"
              : (institution?.name ?? "לא נבחר מוסד אקדמי")}
        </Text>
        {!institutionLoading && !institutionError && institutionYear && (
          <Text style={ui.text}>{institutionYear.label}</Text>
        )}
        <Text style={ui.text}>
          {institutionError
            ? "פתחו את פרטי הלימודים כדי לנסות שוב."
            : institution && !institutionYear && !yearLoading
              ? "השיוך למוסד נשמר. לוח הלימודים יוצג כאן כשהוא יהיה זמין בחשבון."
              : "המוסד, שנת הלימודים ותאריכי הסמסטרים במקום אחד."}
        </Text>
        <Action
          secondary
          title="המוסד והסמסטרים שלי"
          onPress={() => router.push("/calendars")}
        />
      </View>
      <Disclosure title="החשבון שלי">
        <Text style={ui.text}>{email}</Text>
        <Text style={ui.text}>הקורסים וההתקדמות פרטיים לחשבון שלך.</Text>
        <Action
          secondary
          disabled={busy}
          title="התנתקות"
          onPress={async () => {
            setBusy(true);
            const { error } = await supabase.auth.signOut();
            if (error) setMessage("ההתנתקות נכשלה");
            setBusy(false);
          }}
        />
      </Disclosure>
      {admin && (
        <View style={[ui.card, { borderColor: "#30516F" }]}>
          <Text style={[ui.subtitle, { color: "#7DD3FC" }]}>מרכז ניהול</Text>
          <Text style={ui.text}>
            לוחות לכל המוסדות, סנכרון אוטומטי ובדיקות חיבור. זמין למנהלים בלבד.
          </Text>
          <Action
            secondary
            title="כניסה למרכז הניהול"
            onPress={() => router.push("/admin")}
          />
        </View>
      )}
      <Disclosure title="מתקדם · איפוס נתונים">
        <Text style={ui.text}>
          מחיקת כל הקורסים, המפגשים וההערות שלך. הפעולה אינה הפיכה.
        </Text>
        <TouchableOpacity disabled={busy} onPress={() => setConfirm(true)}>
          <Text style={{ color: "#FCA5A5", textAlign: "right" }}>
            מחיקת הקורסים שלי
          </Text>
        </TouchableOpacity>
      </Disclosure>
      {!!message && (
        <Text accessibilityRole="alert" style={ui.text}>
          {message}
        </Text>
      )}
      <ConfirmModal
        visible={confirm}
        title="מחיקת הקורסים שלי"
        message="כל הקורסים, המפגשים וההערות בחשבון הזה יימחקו לצמיתות. להמשיך?"
        confirmLabel="מחיקה לצמיתות"
        cancelLabel="ביטול"
        isDestructive
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </Page>
  );
}
