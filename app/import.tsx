import { CourseToggle } from "../components/CourseToggle";
import { courseColor } from "../constants/courseColors";
import { CourseColorPicker } from "../components/CourseColorPicker";
import { CalendarRecovery } from "../components/CalendarRecovery";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Page,
  ui,
  Action,
  Badge,
  Disclosure,
  CalendarSummary,
} from "../components/SettingsUI";
import { useSemesterContext } from "../hooks/useSemesterContext";
import { ImportPreview, parseSemesterText } from "../lib/semesterImport";
import { prepareLocalPdfReader, readLocalPdf } from "../lib/localPdf";
import { profileFields } from "../lib/calendars";
import { supabase } from "../lib/supabase";
import { Semester } from "../types";
import { beginImportHandoff, cancelImportHandoff, completeImportHandoff, IMPORT_FLOW_EVENT, takeImportHandoff } from '../lib/importHandoff';

let persistentPdfHandler: ((file: File) => void) | null = null;
let persistentPdfInputBound = false;

function persistentPdfInput() {
  let input = document.getElementById('course-track-pdf-input') as HTMLInputElement | null;
  if (!input) {
    input = document.createElement('input');
    input.id = 'course-track-pdf-input';
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);
  }
  input.accept = '.pdf,application/pdf';
  input.setAttribute('aria-label', 'בחירת PDF מהמכשיר');
  if (!persistentPdfInputBound) {
    input.addEventListener('change', () => {
      const file = input!.files?.[0];
      input!.value = '';
      if (file) persistentPdfHandler?.(file);
    });
    persistentPdfInputBound = true;
  }
  return input;
}

function PdfFileButton({ disabled, onFile }: { disabled: boolean; onFile: (file: File) => void }) {
  const onFileRef = useRef(onFile);
  const lastOpen = useRef(0);
  onFileRef.current = onFile;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // This input deliberately lives outside the route. Some Android PWAs
    // temporarily navigate to '/' while their system file picker is open;
    // a route-owned input would be unmounted before its change event arrives.
    persistentPdfHandler = (file) => onFileRef.current(file);
    persistentPdfInput();
  }, []);

  const openPicker = () => {
    if (Platform.OS !== 'web' || disabled || Date.now() - lastOpen.current < 500) return;
    lastOpen.current = Date.now();
    const input = persistentPdfInput() as HTMLInputElement & { showPicker?: () => void };
    beginImportHandoff();
    try {
      // showPicker is the most reliable path in current Android Chromium;
      // click remains the compatible fallback for older browsers.
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      try { input.click(); } catch { cancelImportHandoff(); }
    }
  };

  if (Platform.OS !== 'web') return <Action disabled={disabled} title="בחירת PDF מהמכשיר" onPress={() => {}} />;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="בחירת PDF מהמכשיר" disabled={disabled} onPressIn={openPicker} onPress={openPicker} style={[ui.button, disabled && { opacity: 0.45 }]}>
    <Text style={ui.buttonText}>{disabled ? 'מעבד…' : 'בחירת PDF מהמכשיר'}</Text>
  </TouchableOpacity>;
}

export default function ImportScreen() {
  const router = useRouter();
  const context = useSemesterContext();
  const { loading } = context;
  const academicYear = context.target?.year ?? null;
  const semester = context.target?.semester ?? null;
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const [edited, setEdited] = useState<Record<string, string[]>>({});
  const markEdited = (key: string, field: string) => setEdited(old => ({ ...old, [key]: [...new Set([...(old[key] ?? []), field])] }));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const readingPdf = useRef(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const receiveHandoff = () => {
      const handoff = takeImportHandoff();
      if (handoff) {
        setPreview(handoff);
        setExcluded([]);
        setEdited({});
        setDone(false);
      }
    };
    receiveHandoff();
    if (typeof window !== 'undefined') window.addEventListener(IMPORT_FLOW_EVENT, receiveHandoff);
    // Load the parser before opening the picker. Mobile PWAs are much more
    // reliable when a file selection does not also start a module download.
    if (Platform.OS === 'web') void prepareLocalPdfReader().catch(() => undefined);
    return () => { if (typeof window !== 'undefined') window.removeEventListener(IMPORT_FLOW_EVENT, receiveHandoff); };
  }, []);
  const prepare = (text: string) => {
    const result = parseSemesterText(text);
    const nextPreview = {
      ...result,
      courses: result.courses.map((c, i) => ({ ...c, color: courseColor(i) })),
    };
    setPreview(nextPreview);

    setExcluded([]);
    setEdited({});
    setMessage("");
    setDone(false);
    setPaste("");
  };
  const readPdf = useCallback(async (file: File) => {
    if (readingPdf.current) return;
    readingPdf.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = parseSemesterText(await readLocalPdf(file));
      const nextPreview = { ...result, courses: result.courses.map((course, index) => ({ ...course, color: courseColor(index) })) };
      completeImportHandoff(nextPreview);
      setPreview(nextPreview);
      setExcluded([]);
      setEdited({});
      setDone(false);
      setPaste("");
    } catch {
      cancelImportHandoff();
      setMessage("לא ניתן לקרוא את הקובץ. יש לבחור PDF עם טקסט, ללא סיסמה ועד 10MB. אפשר גם להדביק את פלט החילוץ.");
    } finally {
      readingPdf.current = false;
      setBusy(false);
    }
  }, []);
  const editSlot = (
    index: number,
    si: number,
    change: Record<string, string | number>,
  ) => {
    if (preview) {
      markEdited(preview.courses[index].import_key, "slots_data");
      for (const field of Object.keys(change)) markEdited(preview.courses[index].import_key, `slot:${si}:${field}`);
    }
    setPreview((p) =>
      p
        ? {
            ...p,
            courses: p.courses.map((c, i) =>
              i === index
                ? {
                    ...c,
                    slots_data: c.slots_data.map((slot, j) =>
                      j === si ? { ...slot, ...change } : slot,
                    ),
                  }
                : c,
            ),
          }
        : p,
    );
  };
  const selected =
    preview?.courses.filter((c) => !excluded.includes(c.import_key)) ?? [];
  const save = async () => {
    if (
      !academicYear ||
      !semester ||
      !selected.length ||
      busy ||
      loading ||
      context.error
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const capability = await supabase.rpc("import_semester_capabilities");
      if (capability.error || capability.data !== 3) {
        setMessage(capability.error && capability.error.code !== "PGRST202"
          ? "לא ניתן לבדוק את תמיכת השרת בייבוא. לא נשמרו שינויים; נסו שוב."
          : "נדרש עדכון מסד הנתונים לפני הייבוא: על המנהל להריץ את 202611070005_import_preview_colors.sql ב־Supabase. הבחירות שלכם נשמרו בתצוגה זו.");
        return;
      }
      const { data, error } = await supabase.rpc("import_semester", {
        p_year: academicYear.id,
        p_semester: semester,
        p_courses: selected.map(c => ({ ...c, edited_fields: edited[c.import_key] ?? [] })),
        p_profile: preview?.profile ?? {},
      });
      if (error) {
        setMessage(
          error.code === "PGRST202"
            ? "נדרש להפעיל את עדכון מסד הנתונים לייבוא. פנו למנהל."
            : "הייבוא לא נשמר. בדקו את תאריכי הסמסטר ואת פרטי המפגשים ונסו שוב.",
        );
        return;
      }
      setDone(true);
      setMessage(
        `נוספו ${data.added} קורסים. עודכנו ${data.updated ?? 0} קורסים. ${data.skipped ? `${data.skipped} קורסים כבר יובאו ונשמרו ללא שינוי.` : ""}`,
      );
      setPreview(null);
    } catch {
      setMessage("החיבור נותק. אפשר לנסות שוב; קורסים שכבר יובאו לא יוכפלו.");
    } finally {
      setBusy(false);
    }
  };
  const key = semester === "א" ? "a" : semester === "ב" ? "b" : "c";
  const hasDates =
    academicYear &&
    academicYear[`semester_${key}_start` as keyof typeof academicYear] &&
    academicYear[`semester_${key}_end` as keyof typeof academicYear];
  return (
    <Page title="ייבוא מערכת שעות">
      <Badge text="עיבוד מקומי · ללא AI" />
      <Text style={ui.text}>
        הקובץ נשאר במכשיר. רק הקורסים והפרטים האקדמיים שתאשרו יישמרו בחשבון.
        החילוץ מותאם למבנה מערכת השעות של HIT.
      </Text>
      {!loading && !done && (
        <View style={ui.card}>
          <Text style={ui.subtitle}>
            {academicYear
              ? `${academicYear.label} · סמסטר ${semester}`
              : context.institutionId
                ? "ממתינים ללוח המוסד"
                : "איפה לומדים?"}
          </Text>
          <Text style={ui.text}>
            {context.error ||
              (academicYear
                ? context.automatic
                  ? "זוהה אוטומטית לפי התאריך ולוח המוסד. בתקופה שבין סמסטרים מוצע הסמסטר הבא."
                  : "הייבוא יישמר בסמסטר שבחרת."
                : context.institutionId
                  ? "המוסד נבחר, אך תאריכי הסמסטר עדיין לא זמינים בחשבון. הקורסים שחולצו נשארים כאן; אפשר לבדוק את הלוח מחדש בלי להעלות שוב את הקובץ."
                  : "בחרו את מוסד הלימודים. השנה והסמסטר יזוהו אוטומטית.")}
          </Text>
          {!academicYear && context.institutionId && (
            <CalendarRecovery
              onRefresh={context.refresh}
            />
          )}
          {context.terms.length > 0 && (
            <Disclosure title="אפשרויות מתקדמות">
              {context.terms.map((t) => (
                <Action
                  key={`${t.year.id}-${t.semester}`}
                  secondary
                  disabled={busy}
                  title={`${t.year.label} · סמסטר ${t.semester} · ${t.start.split("-").reverse().join(".")}–${t.end.split("-").reverse().join(".")}`}
                  onPress={() => context.selectTerm(t)}
                />
              ))}
            </Disclosure>
          )}
          {!context.institutionId && (
            <Action
              title="בחירת מוסד"
              onPress={() => router.push("/calendars")}
            />
          )}
          {preview?.semester && semester && preview.semester !== semester && (
            <Text style={[ui.text, { color: "#FCD34D" }]}>
              בקובץ צוין סמסטר {preview.semester}, ובייבוא נבחר סמסטר {semester}
              . בדקו אם לשנות את הסמסטר לפני השמירה.
            </Text>
          )}
        </View>
      )}
      {!done && !preview && (
        <View style={[ui.card, { borderColor: "#6540A1" }]}>
          <Text style={ui.subtitle}>1 · בחירת הקובץ</Text>
          <Text style={ui.text}>PDF עם טקסט · עד 10MB ו־20 עמודים</Text>
          <PdfFileButton disabled={busy} onFile={readPdf} />
          <Disclosure title="כבר יש לי פלט טקסט">
            <TextInput
              accessibilityLabel="פלט חילוץ מערכת השעות"
              multiline
              style={[ui.input, { minHeight: 130 }]}
              value={paste}
              onChangeText={setPaste}
              placeholder="הדביקו כאן את הפלט של תוכנת החילוץ"
              placeholderTextColor="#94A3B8"
            />
            <Action
              secondary
              disabled={busy || !paste.trim()}
              title="תצוגה מקדימה של הפלט"
              onPress={() => prepare(paste)}
            />
          </Disclosure>
        </View>
      )}
      {!!message && (
        <View accessibilityRole="alert" style={ui.card}>
          <Text style={ui.subtitle}>{done ? "הייבוא הושלם" : "עדכון"}</Text>
          <Text style={ui.text}>{message}</Text>
          {done && (
            <Action title="לקורסים שלי" onPress={() => router.replace("/")} />
          )}
        </View>
      )}
      {preview && (
        <>
          <Action
            secondary
            disabled={busy}
            title="בחירת קובץ או פלט אחר"
            onPress={() => setPreview(null)}
          />
          {preview.warnings.length > 0 && (
            <View style={[ui.card, { borderColor: "#B78B32" }]}>
              <Text style={[ui.subtitle, { color: "#FCD34D" }]}>
                דורש תשומת לב
              </Text>
              {preview.warnings.map((w) => (
                <Text key={w} selectable style={ui.text}>
                  {w}
                </Text>
              ))}
            </View>
          )}
          {preview.courses.map((c, index) => (
            <View
              key={c.import_key}
              style={[
                ui.card,
                {
                  borderRightWidth: 4,
                  borderRightColor: excluded.includes(c.import_key)
                    ? "#434353"
                    : (c.color ?? courseColor(index)),
                  backgroundColor: excluded.includes(c.import_key)
                    ? "#151521"
                    : "#1E1E35",
                },
              ]}
            >
              <View style={ui.row}>
                <CourseToggle
                  enabled={!excluded.includes(c.import_key)}
                  color={c.color ?? courseColor(index)}
                  label={`ייבוא הקורס ${c.name}`}
                  disabled={busy}
                  onToggle={() =>
                    setExcluded((old) =>
                      old.includes(c.import_key)
                        ? old.filter((k) => k !== c.import_key)
                        : [...old, c.import_key],
                    )
                  }
                />
                <TextInput
                  accessibilityLabel="שם הקורס"
                  editable={!busy && !excluded.includes(c.import_key)}
                  style={[
                    ui.input,
                    { flex: 1 },
                    excluded.includes(c.import_key) && {
                      color: "#737387",
                      backgroundColor: "transparent",
                      borderColor: "transparent",
                    },
                  ]}
                  value={c.name}
                  onChangeText={(name) => {
                    markEdited(c.import_key, "name");
                    setPreview((p) =>
                      p
                        ? {
                            ...p,
                            courses: p.courses.map((item, i) =>
                              i === index ? { ...item, name } : item,
                            ),
                          }
                        : p,
                    )
                  }}
                />
              </View>
              {excluded.includes(c.import_key) ? (
                <Text style={[ui.text, { color: "#646477" }]}>
                  {c.course_code} · {c.credits} נ״ז · {c.weekly_hours} שעות
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  <CourseColorPicker
                    color={c.color ?? courseColor(index)}
                    disabled={busy}
                    onChange={(color) => {
                      markEdited(c.import_key, "color");
                      setPreview((p) =>
                        p
                          ? {
                              ...p,
                              courses: p.courses.map((item, i) =>
                                i === index ? { ...item, color } : item,
                              ),
                            }
                          : p,
                      )
                    }}
                  />
                  <Text style={ui.text}>
                    {c.course_code} · {c.credits} נ״ז · {c.weekly_hours} שעות
                  </Text>
                  <Disclosure
                    title={`${c.slots_data.length} מפגשים שבועיים · הצגה ועריכה`}
                  >
                    {c.slots_data.map((slot, si) => (
                      <View
                        key={si}
                        style={{
                          gap: 8,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: "#38384F",
                        }}
                      >
                        <Text style={ui.subtitle}>
                          {slot.type === "exercise" ? "תרגול" : "הרצאה / מעבדה"}{" "}
                          · יום {"אבגדהוש"[slot.day_of_week]}
                        </Text>
                        <View style={ui.row}>
                          {(["start_time", "end_time"] as const).map(
                            (field) => (
                              <TextInput
                                key={field}
                                accessibilityLabel={
                                  field === "start_time"
                                    ? "שעת התחלה"
                                    : "שעת סיום"
                                }
                                editable={!busy}
                                style={[ui.input, { flex: 1 }]}
                                value={slot[field]}
                                onChangeText={(value) => editSlot(index, si, { [field]: value })}
                              />
                            ),
                          )}
                        </View>
                        <View style={ui.row}>
                          {"אבגדהוש".split("").map((day, di) => (
                            <TouchableOpacity
                              key={day}
                              accessibilityRole="button"
                              accessibilityLabel={`יום ${day}`}
                              disabled={busy}
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor:
                                  slot.day_of_week === di
                                    ? "#7C3AED"
                                    : "#0F0F1A",
                              }}
                              onPress={() =>
                                editSlot(index, si, { day_of_week: di })
                              }
                            >
                              <Text
                                style={{ textAlign: "center", color: "#fff" }}
                              >
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Action
                          secondary
                          disabled={busy}
                          title={
                            slot.type === "exercise"
                              ? "סוג: תרגול · לחצו לשינוי"
                              : "סוג: הרצאה / מעבדה · לחצו לשינוי"
                          }
                          onPress={() =>
                            editSlot(index, si, {
                              type:
                                slot.type === "exercise"
                                  ? "lecture"
                                  : "exercise",
                            })
                          }
                        />
                        <Text style={ui.text}>מרצה</Text>
                        <TextInput
                          accessibilityLabel="מרצה"
                          editable={!busy}
                          style={ui.input}
                          value={slot.lecturer}
                          onChangeText={(lecturer) =>
                            editSlot(index, si, { lecturer })
                          }
                        />
                        <Text style={ui.text}>חדר</Text>
                        <TextInput
                          accessibilityLabel="חדר"
                          editable={!busy}
                          style={ui.input}
                          value={slot.room}
                          onChangeText={(room) => editSlot(index, si, { room })}
                        />
                      </View>
                    ))}
                  </Disclosure>
                </View>
              )}
            </View>
          ))}
          <Disclosure title="פרטים אקדמיים שיישמרו בחשבון">
            {profileFields.map(([field, label]) => (
              <View key={field}>
                <Text style={ui.text}>{label}</Text>
                <TextInput
                  editable={!busy}
                  accessibilityLabel={label}
                  maxLength={200}
                  style={ui.input}
                  value={preview.profile[field] ?? ""}
                  onChangeText={(value) =>
                    setPreview((p) =>
                      p
                        ? { ...p, profile: { ...p.profile, [field]: value } }
                        : p,
                    )
                  }
                />
              </View>
            ))}
            <Text style={ui.text}>שדה ריק לא יחליף מידע קיים.</Text>
          </Disclosure>
          <Text style={ui.text}>
            באישור יישמרו הצבעים המוצגים, גם בקורסים שכבר יובאו. פרטים אחרים יעודכנו רק אם שיניתם אותם כאן. הנוכחות וההערות הקיימות נשמרות.
          </Text>
          {!hasDates && semester && (
            <Text style={[ui.text, { color: "#FCD34D" }]}>
              חסרים תאריכים לסמסטר שנבחר. הגדירו אותם במסך הלימודים שלי.
            </Text>
          )}
          {!academicYear && (
            <Text
              accessibilityRole="alert"
              style={[ui.text, { color: "#FCD34D" }]}
            >
              האישור חסום כי חסרים תאריכי סמסטר ליצירת המפגשים. בדקו את זמינות
              הלוח באזור שבראש המסך; אין צורך לנתח את הקובץ מחדש.
            </Text>
          )}
          <Text style={ui.text}>
            {selected.length} קורסים · {selected.reduce((n, c) => n + c.slots_data.length, 0)} מפגשים בשבוע · {selected.reduce((n, c) => n + c.credits, 0)} נקודות זכות
          </Text>
          <Action
            disabled={
              busy ||
              loading ||
              !semester ||
              !!context.error ||
              !hasDates ||
              !selected.length ||
              selected.some((c) => !c.name.trim())
            }
            title={busy ? "שומר…" : `אישור וייבוא ${selected.length} קורסים`}
            onPress={save}
          />
        </>
      )}
    </Page>
  );
}
