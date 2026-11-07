import { SlotData, Semester } from "../types";
export interface ImportCourse {
  name: string;
  import_key: string;
  course_code: string;
  credits: number;
  weekly_hours: number;
  slots_data: (SlotData & { lecturer: string; room: string; code: string })[];
}
export interface ImportPreview {
  courses: ImportCourse[];
  profile: Record<string, string>;
  semester: Semester | null;
  warnings: string[];
}
const tidy = (s: string) =>
  s
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const baseName = (s: string) =>
  tidy(
    s
      .replace(/\s*[-–(]?\s*(?:תרגול|תרגיל)\s*[()]*\s*$/, "")
      .replace(/[()]/g, ""),
  ).replace(/\s*['׳״"]\s*/g, "'");
export function parseSemesterText(text: string): ImportPreview {
  const profile: Record<string, string> = {};
  const warnings: string[] = [];
  const rows: {
    name: string;
    code: string;
    credits: number;
    hours: number;
    slot: ImportCourse["slots_data"][number];
  }[] = [];
  const lines = text.split(/\r?\n/).map(tidy);
  let pending = "";
  let inTable = false;
  const semesters = [
    ...new Set([...text.matchAll(/סמסטר\s*([אבג]|קיץ)/g)].map((m) => m[1])),
  ];
  if (semesters.length > 1)
    return {
      courses: [],
      profile: {},
      semester: null,
      warnings: [
        "נמצאו כמה סמסטרים בקובץ. יש לייבא מערכת של סמסטר אחד בכל פעם.",
      ],
    };
  const semester = (semesters[0] as Semester) ?? null;
  for (const line of lines) {
    if (!line || /^=+$/.test(line)) continue;
    if (/שם שיעור/.test(line) && /קוד שיעור/.test(line)) {
      inTable = true;
      pending = "";
      continue;
    }
    if (/מסלול/.test(line)) {
      profile.track = line
        .split("מסלול")[1]
        .split(/שנה|כיתה/)[0]
        .trim();
      const yr = line.match(/שנה\s+([א-ת0-9]+)[׳']?/);
      if (yr) profile.study_year = yr[1];
    }
    if (/התמחויות/.test(line))
      profile.specialization = line.split("התמחויות")[1].trim();
    if (/^סטטוס\s/.test(line))
      profile.student_status = line.replace(/^סטטוס\s*/, "");
    if (/מטרה/.test(line)) {
      profile.goal = line.split("מטרה")[1].split("רמת אנגלית")[0].trim();
      profile.degree = profile.goal;
    }
    if (/רמת אנגלית/.test(line))
      profile.english_level = line.split("רמת אנגלית")[1].trim();
    let m = line.match(
      /^([אבגדהוש])[׳']?\s*\|\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\|\s*קוד:\s*([\d-]+)\s*\|\s*(.*?)\s*\|\s*נ\.ז:\s*([\d.]+)\s*\|\s*שעות:\s*([\d.]+)\s*\|\s*מרצה:\s*(.*?)\s*\|\s*חדר:\s*(.*)$/,
    );
    if (!m) {
      const raw = line.match(
        /^([אבגדהוש])[׳']?\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{5,6}-\d+)\s+(.*?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+(.*)$/,
      );
      if (raw) {
        const tail = raw[8].match(
          /^(.*?)\s*((?:\d{2,4}-\d+)|(?:למידה בזום\s*\d+))$/,
        );
        m = [
          raw[0],
          ...raw.slice(1, 5),
          tidy(pending + " " + raw[5]),
          raw[6],
          raw[7],
          tail?.[1] ?? raw[8],
          tail?.[2] ?? "",
        ] as RegExpMatchArray;
        pending = "";
      }
    }
    if (!m) {
      if (/\d{2}:\d{2}/.test(line)) {
        warnings.push("שורה עם שעות לא זוהתה. בדקו שלא חסר קורס בתצוגה.");
        pending = "";
      } else if (inTable && !/סה["״']?כ|מערכת|עמוד|סמסטר/.test(line)) {
        pending = line;
      }
      continue;
    }
    const [, day, start, end, code, name, credit, hours, lecturer, room] = m;
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
      end <= start ||
      !name ||
      !Number.isFinite(Number(credit)) ||
      !Number.isFinite(Number(hours))
    ) {
      warnings.push(`לא ניתן לייבא שעות לא תקינות: ${name}`);
      continue;
    }
    rows.push({
      name,
      code,
      credits: Number(credit),
      hours: Number(hours),
      slot: {
        type: /תרגול|תרגיל/.test(name) ? "exercise" : "lecture",
        day_of_week: "אבגדהוש".indexOf(day),
        start_time: start,
        end_time: end,
        lecturer: tidy(lecturer),
        room: tidy(room),
        code,
      },
    });
  }
  const courses: ImportCourse[] = [];
  for (const row of rows) {
    const name = baseName(row.name);
    let course = courses.find((c) => baseName(c.name) === name);
    if (!course) {
      course = {
        name,
        import_key: name,
        course_code: row.code,
        credits: row.credits,
        weekly_hours: row.hours,
        slots_data: [],
      };
      courses.push(course);
    }
    if (row.slot.type === "lecture") {
      course.course_code = row.code;
      course.credits = Math.max(course.credits, row.credits);
      course.weekly_hours = Math.max(course.weekly_hours, row.hours);
    }
    if (
      !course.slots_data.some(
        (s) =>
          s.type === row.slot.type &&
          s.day_of_week === row.slot.day_of_week &&
          s.start_time === row.slot.start_time &&
          s.end_time === row.slot.end_time,
      )
    )
      course.slots_data.push(row.slot);
  }
  for (const c of courses)
    if (c.slots_data.every((s) => s.type === "exercise"))
      warnings.push(`זוהה תרגול ללא הרצאה: ${c.name}`);
  if (!courses.length)
    warnings.push(
      "לא נמצאו קורסים. אפשר להדביק את הפלט של תוכנת החילוץ. קובץ סרוק אינו נתמך.",
    );
  return { courses, profile, semester, warnings: [...new Set(warnings)] };
}
