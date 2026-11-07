import { suggestTerm } from "../lib/semesterContext";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import { supabase } from "../lib/supabase";
import {
  CalendarRun,
  CalendarSource,
  Institution,
  InstitutionCalendar,
  StudentProfile,
  editableDates,
  profileFields,
} from "../lib/calendars";
import { AcademicYear } from "../types";
import { AcademicYearModal } from "../components/AcademicYearModal";
import { Badge, Disclosure, CalendarSummary } from "./SettingsUI";
import { ConfirmModal } from "../components/ConfirmModal";

function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.link}>{title}</Text>
    </TouchableOpacity>
  );
}
const dateTime = (v: string | null) =>
  v ? new Date(v).toLocaleString("he-IL") : "טרם בוצעה";

export default function CalendarWorkspace({
  management = false,
}: {
  management?: boolean;
}) {
  const router = useRouter();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [calendars, setCalendars] = useState<InstitutionCalendar[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [profile, setProfile] = useState<Partial<StudentProfile>>({});
  const [selected, setSelected] = useState<string>("");
  const [authorized, setAdmin] = useState(false);
  const admin = management && authorized;
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [runs, setRuns] = useState<CalendarRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState<{
    ok: boolean;
    checked_at: string;
    scope: string;
    checks: { id: string; status: string; label: string; detail: string }[];
  } | null>(null);
  const [editor, setEditor] = useState<{
    mode: "personal" | "shared";
    current: AcademicYear | null;
  } | null>(null);
  const [adopt, setAdopt] = useState<InstitutionCalendar | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [scheduledHealth, setScheduledHealth] = useState<any>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const responses = await Promise.all([
        supabase.from("institutions").select("*").order("name"),
        supabase
          .from("institution_calendars")
          .select("*")
          .order("start_year", { ascending: false }),
        supabase
          .from("academic_years")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("student_profiles").select("*").maybeSingle(),
        supabase.rpc("is_app_admin"),
      ]);
      for (const response of responses)
        if (response.error) throw response.error;
      const inst = responses[0].data as unknown as Institution[];
      const prof = responses[3].data as unknown as StudentProfile | null;
      setInstitutions(inst);
      setCalendars(responses[1].data as unknown as InstitutionCalendar[]);
      setYears(responses[2].data as unknown as AcademicYear[]);
      setProfile(prof ?? {});
      setSelected((current) =>
        management ? current || inst[0]?.id || "" : prof?.institution_id || "",
      );
      const isAdmin = responses[4].data === true;
      setAdmin(isAdmin);
      if (isAdmin && management) {
        const [src, logs, pending, health] = await Promise.all([
          supabase.from("calendar_sources").select("*"),
          supabase
            .from("calendar_sync_runs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("calendar_sync_runs")
            .select("*")
            .eq("status", "review")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase.from("calendar_health").select("result").maybeSingle(),
        ]);
        if (src.error) throw src.error;
        if (logs.error) throw logs.error;
        if (pending.error) throw pending.error;
        if (health.error) throw health.error;
        setSources(src.data);
        setRuns(
          [
            ...new Map(
              [...(logs.data ?? []), ...(pending.data ?? [])].map((r) => [
                r.id,
                r,
              ]),
            ).values(),
          ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
        setScheduledHealth(health.data?.result ?? null);
      }
    } catch {
      setLoadError(
        "לא ניתן לטעון את הלוחות. ודאו שקובץ ה־SQL החדש הופעל ושהחיבור תקין.",
      );
    } finally {
      setLoading(false);
    }
  }, [management]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const action = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await reload();
      setMessage(success);
    } catch (e: any) {
      await reload();
      setMessage(e.message || "הפעולה נכשלה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  const check = (r: { error: any }) => {
    if (r.error) throw r.error;
  };
  const saveProfile = async (extra: Partial<StudentProfile> = {}) => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error("נדרשת כניסה מחדש");
    check(
      await supabase
        .from("student_profiles")
        .upsert({ ...profile, ...extra, user_id: user.id }),
    );
  };
  const saveEditor = async (data: Omit<AcademicYear, "id" | "created_at">) => {
    if (!editor) return { error: new Error("בחרו מוסד") };
    try {
      const fields = editableDates(data as AcademicYear);
      if (editor.mode === "shared") {
        const start = Number(newYear);
        if (!Number.isInteger(start) || start < 2000 || start > 2200)
          throw new Error("שנת ההתחלה אינה תקינה");
        const shared = {
          ...fields,
          institution_id: selected,
          start_year: start,
          notes,
          origin: "manual",
          source_hash: null,
        };
        check(
          editor.current
            ? await supabase
                .from("institution_calendars")
                .update(shared)
                .eq("id", editor.current.id)
            : await supabase.from("institution_calendars").insert(shared),
        );
      } else {
        const personal = {
          ...fields,
          institution_id: editor.current?.institution_id ?? (selected || null),
          date_mode: "manual",
        };
        if (editor.current)
          check(
            await supabase
              .from("academic_years")
              .update(personal)
              .eq("id", editor.current.id),
          );
        else {
          const result = await supabase
            .from("academic_years")
            .insert(personal)
            .select("id")
            .single();
          check(result);
          await saveProfile({
            institution_id: selected,
            active_academic_year_id: result.data!.id,
          });
        }
      }
      setMessage(
        editor.mode === "shared"
          ? "הלוח המשותף נשמר. הלוח יופץ אוטומטית למשתמשי המוסד. התאמות ידניות נשמרות."
          : "התאריכים האישיים נשמרו. מפגשים קיימים לא שונו.",
      );
      await reload();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };
  const source = sources.find((x) => x.institution_id === selected);
  const institution = institutions.find((x) => x.id === selected);
  const suggestion = suggestTerm(
    years.filter((y) => y.institution_id === profile.institution_id),
  );
  const activeId =
    profile.active_academic_year_id ?? suggestion?.year.id ?? years[0]?.id;
  const active = profile.institution_id
    ? years.find(
        (x) => x.id === activeId && x.institution_id === profile.institution_id,
      )
    : undefined;
  const currentShared = calendars.find((x) => x.id === active?.calendar_id);
  const sync = () =>
    action(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/calendar-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ source_id: source?.id }),
      });
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      )
        throw new Error(
          "הרצת הסנכרון זמינה בפריסה ב־Vercel או ב־vercel dev. שרת Expo אינו מפעיל פונקציות שרת.",
        );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? result.results?.[0]?.message ?? "הסנכרון נכשל",
        );
      if (result.results?.[0]?.status === "skipped")
        throw new Error(result.results[0].message);
    }, "בדיקת המקור הסתיימה. התוצאה מופיעה ביומן הסנכרון.");
  const diagnose = async () => {
    setBusy(true);
    setMessage("");
    setDiagnostics(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/calendar-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ action: "diagnostics" }),
      });
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      )
        throw new Error(
          "הבדיקה זמינה בפריסה ב־Vercel או ב־vercel dev, ולא בשרת Expo.",
        );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "בדיקת החיבור נכשלה");
      if (!result.diagnostics)
        throw new Error(
          "השרת עדיין אינו מכיל את עדכון בדיקת החיבור. יש לפרוס את הגרסה החדשה.",
        );
      setDiagnostics(result.diagnostics);
    } catch (e: any) {
      setMessage(e.message || "לא ניתן להשלים את בדיקת החיבור.");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primaryLight} />
      </View>
    );
  if (loadError)
    return (
      <View style={s.center}>
        <Text style={s.text}>{loadError}</Text>
        <Button title="ניסיון נוסף" onPress={reload} />
        <Button title="חזרה" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} />
      </View>
    );
  if (management && !authorized)
    return (
      <View style={s.center}>
        <Text style={s.title}>מרכז הניהול זמין למנהלים בלבד</Text>
        <Button
          title="חזרה להגדרות"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
        />
      </View>
    );
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Button title="→ חזרה" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} />
        <Text style={s.title}>
          {management ? "מרכז ניהול" : "הלימודים שלי"}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.text}>
          {management
            ? "פרסום לוח מוסדי מעדכן את כל המשתמשים המשויכים אליו."
            : "הלוח מגיע מהמוסד שלך. אפשר להתאים את התאריכים לצרכים שלך."}
        </Text>
        {!!message && (
          <Text accessibilityRole="alert" style={s.message}>
            {message}
          </Text>
        )}
        <Disclosure
          title={management ? "בחירת מוסד לניהול" : "המוסד שלי"}
          initial={!selected || management}
        >
          <Text style={s.title}>{institution?.name ?? "איפה לומדים?"}</Text>
          {!management && (
            <Button
              title={`${!profile.institution_id ? "✓ " : ""}לא נבחר מוסד אקדמי`}
              disabled={busy}
              onPress={() =>
                action(
                  () =>
                    saveProfile({
                      institution_id: null,
                      active_academic_year_id: null,
                    }),
                  "השיוך למוסד הוסר. הקורסים הקיימים נשמרו.",
                )
              }
            />
          )}
          {institutions.map((i) => (
            <Button
              key={i.id}
              title={`${selected === i.id ? "✓ " : ""}${i.name}`}
              disabled={busy}
              onPress={() => {
                if (!management) {
                  void action(
                    () =>
                      saveProfile({
                        institution_id: i.id,
                        active_academic_year_id: null,
                      }),
                    "המוסד נשמר בפרופיל. זמינות הלוח מופיעה בהמשך.",
                  );
                  return;
                }
                setSelected(i.id);
                setSourceUrl(
                  sources.find((x) => x.institution_id === i.id)?.page_url ??
                    "",
                );
              }}
            />
          ))}
          {!selected && (
            <Text style={s.hint}>
              בחרו מוסד כדי לראות את הלוחות שלו. אין שיוך אוטומטי ל־HIT.
            </Text>
          )}
          <Text style={s.hint}>מוסד שאינו ברשימה ניתן להוספה על ידי מנהל.</Text>
        </Disclosure>
        {!!selected && (
          <Disclosure
            title={
              management ? "לוחות שפורסמו" : "מתקדם · לוחות והתאמות ידניות"
            }
            initial={false}
          >
            <Text style={s.title}>לוחות של {institution?.name}</Text>
            {calendars
              .filter((c) => c.institution_id === selected)
              .map((c) => (
                <View style={s.item} key={c.id}>
                  <Text style={s.subtitle}>
                    {c.label} · גרסה {c.revision}
                  </Text>
                  <CalendarSummary calendar={c} />
                  <Text style={s.hint}>
                    {c.excluded_dates?.length ?? 0} ימים ללא לימודים ·{" "}
                    {c.origin === "manual"
                      ? "הוזן או נערך בידי מנהל"
                      : "יובא מהמקור הרשמי"}
                  </Text>
                  <Text style={s.hint}>עודכן: {dateTime(c.updated_at)}</Text>
                  {!!c.source_url && (
                    <Button
                      title="פתיחת המקור"
                      onPress={() => {
                        if (/^https:\/\//.test(c.source_url!))
                          void Linking.openURL(c.source_url!);
                      }}
                    />
                  )}
                  {!management && (
                    <Button
                      title="בחירת השנה · תאריכים מהמוסד"
                      disabled={busy}
                      onPress={() => setAdopt(c)}
                    />
                  )}
                  {admin && (
                    <Button
                      title="עריכת הלוח המשותף (מנהל)"
                      disabled={busy}
                      onPress={() => {
                        setNewYear(String(c.start_year));
                        setNotes(c.notes);
                        setEditor({ mode: "shared", current: c });
                      }}
                    />
                  )}
                </View>
              ))}
            {!calendars.some((c) => c.institution_id === selected) && (
              <Text style={s.hint}>
                עדיין אין לוח משותף למוסד הזה. אפשר להגדיר שנה אישית ידנית.
              </Text>
            )}
            {!management && (
              <Button
                title="+ שנה אישית ידנית"
                disabled={busy}
                onPress={() => setEditor({ mode: "personal", current: null })}
              />
            )}
          </Disclosure>
        )}
        {!management && (
          <>
            <View style={s.card}>
              <Text style={s.title}>
                {active?.label ??
                  (profile.institution_id
                    ? "ממתינים ללוח המוסד"
                    : "בחרו את מוסד הלימודים שלכם")}
              </Text>
              {suggestion && (
                <>
                  <Text
                    style={s.hint}
                  >{`לייבוא חדש זוהו ${suggestion.year.label}, סמסטר ${suggestion.semester}. אפשר לשנות לפני הייבוא.`}</Text>
                  <Button
                    title="ייבוא לסמסטר הזה · אפשר לשנות"
                    onPress={() => router.push("/import")}
                  />
                </>
              )}
              {active && (
                <>
                  <Badge
                    text={
                      active.date_mode === "calendar"
                        ? "מתעדכן אוטומטית מהמוסד"
                        : "התאמה ידנית · רק בחשבון שלך"
                    }
                    manual={active.date_mode !== "calendar"}
                  />
                  <CalendarSummary calendar={active} />
                  {!!currentShared?.notes && (
                    <Disclosure title="הערות מהלוח הרשמי · ימים חלקיים והשלמות">
                      <Text style={s.hint}>{currentShared.notes}</Text>
                    </Disclosure>
                  )}
                  <Text style={s.hint}>
                    {active.excluded_dates?.length ?? 0} ימים ללא לימודים
                  </Text>
                  <Disclosure title="התאמה ידנית של תאריכים">
                    <Text style={s.hint}>
                      עריכה ידנית מפסיקה את עדכון התאריכים של השנה הזו מהמוסד.
                      מפגשים שכבר נוצרו נשארים כפי שהם.
                    </Text>
                    <Button
                      title="עריכת התאריכים שלי"
                      onPress={() =>
                        setEditor({ mode: "personal", current: active })
                      }
                    />
                    {currentShared && active.date_mode === "manual" && (
                      <Button
                        title="חזרה לעדכונים מלוח המוסד"
                        onPress={() => setAdopt(currentShared)}
                      />
                    )}
                  </Disclosure>
                </>
              )}
              {!active && (
                <Text style={s.hint}>
                  לאחר בחירת מוסד, השנה והסמסטר מזוהים אוטומטית לפי הלוח שלו.
                  כרגע אין לוח זמין; מנהל צריך לפרסם אותו במרכז הניהול.
                </Text>
              )}
            </View>
            <Disclosure title="השנים השמורות שלי">
              {years.map((y) => (
                <View key={y.id} style={s.item}>
                  <Text style={s.subtitle}>{y.label}</Text>
                  <Text style={s.hint}>
                    {institutions.find((i) => i.id === y.institution_id)
                      ?.name ?? "ללא שיוך למוסד"}
                  </Text>
                  <Button
                    title={
                      y.id === activeId ? "✓ השנה הפעילה" : "מעבר לשנה הזו"
                    }
                    disabled={busy || y.id === activeId}
                    onPress={() =>
                      action(
                        () => saveProfile({ active_academic_year_id: y.id }),
                        "השנה הפעילה עודכנה.",
                      )
                    }
                  />
                </View>
              ))}
            </Disclosure>
            <Disclosure title="הפרטים האקדמיים שלי">
              {profileFields.map(([key, label]) => (
                <View key={key}>
                  <Text style={s.hint}>{label}</Text>
                  <TextInput
                    accessibilityLabel={label}
                    style={s.input}
                    value={profile[key] ?? ""}
                    maxLength={200}
                    onChangeText={(v) =>
                      setProfile((p) => ({ ...p, [key]: v }))
                    }
                  />
                </View>
              ))}
              <Button
                title="שמירת פרטים"
                disabled={busy}
                onPress={() => action(() => saveProfile(), "הפרטים נשמרו.")}
              />
            </Disclosure>
          </>
        )}
        {admin && source && (
          <View style={s.card}>
            <Text style={s.title}>סנכרון {institution?.name}</Text>
            <Text style={s.hint}>
              בדיקה אוטומטית מדי יום. רק לוחות שפורסמו מופצים למשתמשים; לוחות
              תקינים נשמרים ומופצים ללא אישור נוסף.
            </Text>
            <Text style={s.hint}>
              בדיקה אחרונה: {dateTime(source.last_checked_at)}
              {"\n"}קריאה מוצלחת: {dateTime(source.last_success_at)}
            </Text>
            <Disclosure title="הגדרות הסנכרון">
              <TextInput
                accessibilityLabel="כתובת מקור הלוח"
                style={s.input}
                value={sourceUrl || source.page_url}
                onChangeText={setSourceUrl}
                autoCapitalize="none"
              />
              <Button
                title="שמירת כתובת המקור"
                disabled={busy}
                onPress={() =>
                  action(async () => {
                    check(
                      await supabase
                        .from("calendar_sources")
                        .update({ page_url: sourceUrl || source.page_url })
                        .eq("id", source.id),
                    );
                  }, "כתובת המקור עודכנה.")
                }
              />
              <View style={s.toggle}>
                <Text style={s.text}>סנכרון פעיל</Text>
                <Switch
                  accessibilityLabel="סנכרון פעיל"
                  value={source.enabled}
                  disabled={busy}
                  onValueChange={(value) =>
                    action(async () => {
                      check(
                        await supabase
                          .from("calendar_sources")
                          .update({ enabled: value })
                          .eq("id", source.id),
                      );
                    }, "הגדרת הסנכרון נשמרה.")
                  }
                />
              </View>

              <Text style={s.hint}>
                לוחות חדשים עם תאריכי סמסטר תקינים מתפרסמים אוטומטית, גם בלי
                משתמשים. לוחות מיובאים מתעדכנים אוטומטית. הערות על ימים חלקיים נשמרות בלוח. תיקוני מנהל ידניים נשמרים; מידע לא תקין מדווח כשגיאת שליפה.
              </Text>
            </Disclosure>
            <Button
              title="בדיקת המקור עכשיו"
              disabled={busy || !source.enabled}
              onPress={sync}
            />
            {runs
              .filter((r) => r.source_id === source.id)
              .slice(0, 1)
              .map((r) => (
                <View key={r.id} style={s.item}>
                  <Badge
                    manual={r.status === "failed" || r.status === "review"}
                    text={
                      r.status === "failed"
                        ? "הבדיקה האחרונה נכשלה"
                        : r.status === "review"
                          ? "הצעה ישנה · יש לרענן מקור"
                          : "הבדיקה האחרונה הושלמה"
                    }
                  />
                  <Text style={s.hint}>{dateTime(r.created_at)}</Text>
                </View>
              ))}
            {runs.some(
              (r) => r.source_id === source.id && r.status === "review",
            ) && (
              <Text style={s.hint}>
                נשארה הצעה מגרסה קודמת. ״בדיקת המקור עכשיו״ תשלוף את הלוח העדכני
                ותשמור אותו ללא אישור נוסף.
              </Text>
            )}
            <Disclosure title="היסטוריית בדיקות">
              {runs
                .filter((r) => r.source_id === source.id)
                .map((r) => (
                  <Disclosure
                    key={r.id}
                    title={`${({ failed: "נכשל", review: "הצעה מגרסה קודמת", published: "פורסם", approved: "אושר", dismissed: "נדחה", unchanged: "ללא שינוי" } as Record<string, string>)[r.status] ?? r.status} · ${dateTime(r.created_at)}`}
                  >
                    <Text style={s.hint}>{r.message}</Text>
                  </Disclosure>
                ))}
            </Disclosure>
          </View>
        )}{" "}
        {admin && (
          <Disclosure title="בדיקות חיבור והרשאות">
            <Text style={s.hint}>
              {scheduledHealth
                ? `בדיקה אוטומטית אחרונה: ${dateTime(scheduledHealth.checked_at)} · ${scheduledHealth.ok ? "תקין" : "דורש טיפול"}`
                : "טרם התקבלה תוצאת בדיקת שרת אוטומטית."}
            </Text>
            {scheduledHealth && (
              <Disclosure title="תוצאות הבדיקה האוטומטית">
                {scheduledHealth.checks.map((c: any) => (
                  <View key={c.id}>
                    <Text style={s.text}>
                      {c.status === "pass" ? "✓" : "✕"} {c.label}
                    </Text>
                    <Text style={s.hint}>{c.detail}</Text>
                  </View>
                ))}
              </Disclosure>
            )}
            <Text style={s.hint}>
              בדיקה נפרדת של החיבור מ־Vercel ל־Supabase, בלי לפנות ל־HIT ובלי
              לשנות נתונים.
            </Text>
            <Button
              title="בדיקת חיבור והרשאות עכשיו"
              disabled={busy}
              onPress={diagnose}
            />
            {diagnostics && (
              <View accessibilityRole="alert" style={s.item}>
                <Text style={s.subtitle}>
                  {diagnostics.ok
                    ? "✓ בדיקות החיבור עברו"
                    : "חלק מבדיקות החיבור נכשלו"}
                </Text>
                <Text style={s.hint}>{dateTime(diagnostics.checked_at)}</Text>
                <Disclosure title="פירוט הבדיקות">
                  {diagnostics.checks.map((c) => (
                    <View key={c.id}>
                      <Text style={s.text}>
                        {c.status === "pass" ? "✓" : "✕"} {c.label}
                      </Text>
                      <Text style={s.hint}>{c.detail}</Text>
                    </View>
                  ))}
                  <Text style={s.hint}>{diagnostics.scope}</Text>
                </Disclosure>
              </View>
            )}
          </Disclosure>
        )}
        {admin && (
          <Disclosure title="הוספת מוסד או לוח ידני">
            <Text style={s.title}>ניהול מוסדות ולוחות</Text>
            <Text style={s.hint}>
              עריכות כאן משותפות לכל המשתמשים. תאריכים אישיים לא נדרסים.
            </Text>
            <TextInput
              accessibilityLabel="שם מוסד חדש"
              placeholder="שם מוסד חדש"
              placeholderTextColor={Colors.textMuted}
              style={s.input}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              accessibilityLabel="מזהה מוסד באנגלית"
              placeholder="מזהה באנגלית, למשל university-name"
              placeholderTextColor={Colors.textMuted}
              style={s.input}
              value={newSlug}
              autoCapitalize="none"
              onChangeText={setNewSlug}
            />
            <Button
              title="הוספת מוסד"
              disabled={
                busy || !newName.trim() || !/^[a-z0-9-]+$/.test(newSlug)
              }
              onPress={() =>
                action(async () => {
                  check(
                    await supabase
                      .from("institutions")
                      .insert({ name: newName.trim(), slug: newSlug }),
                  );
                  setNewName("");
                  setNewSlug("");
                }, "המוסד נוסף. ניתן ליצור עבורו לוח ידני.")
              }
            />
            {!!selected && (
              <>
                <Text style={s.subtitle}>לוח חדש עבור {institution?.name}</Text>
                <Text style={s.hint}>השנה הלועזית שבה מתחילה שנת הלימודים</Text>
                <TextInput
                  accessibilityLabel="שנת תחילת הלוח"
                  style={s.input}
                  value={newYear}
                  onChangeText={setNewYear}
                  keyboardType="numeric"
                />
                <TextInput
                  accessibilityLabel="הערות ללוח המשותף"
                  style={s.input}
                  multiline
                  placeholder="הערות ללוח"
                  placeholderTextColor={Colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  title="הגדרת תאריכים ללוח משותף חדש"
                  disabled={busy}
                  onPress={() => setEditor({ mode: "shared", current: null })}
                />
              </>
            )}
          </Disclosure>
        )}
      </ScrollView>
      <AcademicYearModal
        initialLabel={
          editor?.mode === "shared"
            ? `${newYear}-${Number(newYear) + 1}`
            : undefined
        }
        title={
          editor?.mode === "shared" ? "עריכת לוח משותף" : "תאריכים אישיים בלבד"
        }
        visible={!!editor}
        current={editor?.current ?? null}
        onSave={saveEditor}
        onClose={() => setEditor(null)}
      />
      <ConfirmModal
        visible={!!adopt}
        title="שימוש בלוח המוסד"
        message="יישמר עותק אישי וייבחר כשנה הפעילה. אם כבר השתמשת בלוח הזה, התאריכים והימים ללא לימודים שהגדרת בו יוחלפו. מפגשים קיימים לא ישתנו."
        confirmLabel="שימוש בלוח"
        cancelLabel="ביטול"
        onCancel={() => setAdopt(null)}
        onConfirm={() => {
          const id = adopt!.id;
          setAdopt(null);
          void action(async () => {
            check(
              await supabase.rpc("adopt_institution_calendar", {
                p_calendar_id: id,
              }),
            );
          }, "הלוח נשמר בחשבון שלך. אפשר להתחיל להוסיף קורסים.");
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", padding: 24, gap: 20 },
  header: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  body: { padding: 20, gap: 20, paddingBottom: 50 },
  card: {
    padding: 18,
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  item: {
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  title: {
    fontFamily: "Heebo_700Bold",
    color: Colors.text,
    fontSize: 20,
    textAlign: "right",
  },
  subtitle: {
    fontFamily: "Heebo_600SemiBold",
    color: Colors.text,
    fontSize: 16,
    textAlign: "right",
  },
  text: {
    fontFamily: "Heebo_400Regular",
    color: Colors.textSecondary,
    textAlign: "right",
    fontSize: 14,
  },
  hint: {
    fontFamily: "Heebo_400Regular",
    color: Colors.textSecondary,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 22,
  },
  message: {
    fontFamily: "Heebo_500Medium",
    color: "#FCD34D",
    textAlign: "right",
    lineHeight: 24,
  },
  button: {
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    alignItems: "center",
  },
  link: {
    fontFamily: "Heebo_600SemiBold",
    color: "#C4B5FD",
    textAlign: "center",
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#38384F",
    borderRadius: 10,
    color: Colors.text,
    textAlign: "right",
    fontFamily: "Heebo_400Regular",
  },
  toggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
});
