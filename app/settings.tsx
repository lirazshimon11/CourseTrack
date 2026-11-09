import React, { useState } from "react";
import { Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAcademicYear } from "../hooks/useAcademicYear";
import { useCourses } from "../hooks/useCourses";
import { ConfirmModal } from "../components/ConfirmModal";
import { AccountDetails } from "../components/AccountDetails";
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
  const { deleteAllData } = useCourses(academicYear ? academicYear.id : null);
  const [accountRevision, setAccountRevision] = useState(0);
  const [admin, setAdmin] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const deleteAccount = async () => {
    setDeleteAccountConfirm(false);
    setBusy(true);
    setMessage("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("פג תוקף החיבור. התחברו מחדש ונסו שוב.");
      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
      if (!apiBase) throw new Error("כתובת שרת המחיקה אינה מוגדרת באפליקציה.");
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) throw new Error(result?.error ?? "מחיקת החשבון נכשלה. נסו שוב מאוחר יותר.");
      await supabase.auth.signOut();
      // Authentication is shown by AuthGate on the root route; there is no /login page.
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "מחיקת החשבון נכשלה. נסו שוב מאוחר יותר.");
    } finally {
      setBusy(false);
      setDeleteAccountPhrase("");
    }
  };
  const exportCourses = async () => {
    setExporting(true); setMessage('');
    try {
      const { data, error } = await supabase.rpc('export_my_courses');
      if (error || !data) throw new Error('לא ניתן לייצא את הנתונים. בדקו את החיבור ושהמערכת מעודכנת.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
      const link = document.createElement('a'); link.href=url; link.download=`CourseTrack-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      setMessage('קובץ הנתונים מוכן והועבר להורדה.');
    } catch(e) { setMessage(e instanceof Error ? e.message : 'הייצוא נכשל. נסו שוב.'); }
    finally { setExporting(false); }
  };
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
      setAccountRevision(value => value + 1);
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
      <View style={ui.card}>
        <Text style={ui.subtitle}>מערכת השעות שלי</Text>
        <Text style={ui.text}>בחירת סמסטר, עיצוב המערכת והורדת תמונה — בעמוד אחד.</Text>
        <Action title="יצירת מערכת שעות" onPress={() => router.push('/timetable')} />
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
      <View style={ui.card}>
        <Text style={ui.subtitle}>ייצוא כל נתוני הקורסים שלי</Text>
        <Text style={ui.text}>קובץ JSON עם כל הקורסים מכל השנים והסמסטרים, כל המפגשים, סימוני הנוכחות וההיעדרות, ההערות שכתבתם ופרטי לוחות הלימודים.</Text>
        {Platform.OS === 'web' ? <Action title={exporting ? 'מכין את הקובץ…' : 'הורדת כל הנתונים שלי (JSON)'} disabled={exporting || busy} onPress={() => void exportCourses()} /> : <Text style={ui.text}>להורדת הקובץ, פתחו את ההגדרות בגרסת הדפדפן.</Text>}
      </View>
      <Disclosure title="מתקדם · איפוס נתונים">
        <Text style={ui.text}>
          מחיקת כל הקורסים, המפגשים וההערות שלך, כולל ההיסטוריה. הפעולה אינה הפיכה.
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
      {admin && (
        <View style={{ borderTopWidth: 1, borderTopColor: "#30516F", paddingTop: 18, gap: 10 }}>
          <Text style={ui.text}>ניהול המערכת</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/admin')} style={[ui.button,{borderWidth:2,borderColor:'#FACC15',backgroundColor:'#292515'}]}><Text style={[ui.buttonText,{color:'#FDE68A'}]}>מעבר לדף המנהל</Text></TouchableOpacity>
        </View>
      )}
      <Disclosure title="החשבון שלי">
        <AccountDetails key={accountRevision} />
        <Text style={ui.text}>מחיקת החשבון תסיר לצמיתות את פרטי החשבון, שנות הלימוד, הקורסים, המפגשים, ההערות וההיסטוריה.</Text>
        <TouchableOpacity disabled={busy} onPress={() => setDeleteAccountConfirm(true)}>
          <Text style={{ color: "#FCA5A5", textAlign: "right" }}>מחיקת החשבון שלי לצמיתות</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="התנתקות מהחשבון"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          style={[
            ui.button,
            { backgroundColor: '#7F1D1D', borderColor: '#F87171', borderWidth: 1 },
            busy && { opacity: 0.45 },
          ]}
          onPress={async () => {
            setBusy(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) setMessage('ההתנתקות נכשלה. נסו שוב.');
            } catch {
              setMessage('ההתנתקות נכשלה. נסו שוב.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={[ui.buttonText, { color: '#FFFFFF' }]}>התנתקות</Text>
        </TouchableOpacity>
      </Disclosure>
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
      <ConfirmModal
        visible={deleteAccountConfirm}
        title="מחיקת החשבון לצמיתות"
        message="כל המידע ששמור בחשבון יימחק ולא ניתן יהיה לשחזר אותו. כדי להמשיך, הקלידו: מחיקת החשבון"
        confirmLabel="מחיקת החשבון לצמיתות"
        cancelLabel="ביטול"
        isDestructive
        confirmDisabled={deleteAccountPhrase.trim() !== "מחיקת החשבון" || busy}
        onConfirm={() => { if (deleteAccountPhrase.trim() === "מחיקת החשבון") void deleteAccount(); }}
        onCancel={() => { setDeleteAccountConfirm(false); setDeleteAccountPhrase(""); }}
      >
        <TextInput
          accessibilityLabel="הקלידו מחיקת החשבון לאישור"
          value={deleteAccountPhrase}
          onChangeText={setDeleteAccountPhrase}
          placeholder="מחיקת החשבון"
          autoCapitalize="none"
          style={{ width: "100%", backgroundColor: "#0B1724", color: "#FFFFFF", borderWidth: 1, borderColor: "#45617A", borderRadius: 10, padding: 12, textAlign: "right", marginBottom: 18 }}
        />
      </ConfirmModal>
    </Page>
  );
}
