import { AcademicYear, Semester } from "../types";
export type Term = {
  year: AcademicYear;
  semester: Semester;
  start: string;
  end: string;
};
export function institutionToday(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}
export function availableTerms(years: AcademicYear[]): Term[] {
  return years
    .flatMap((year) =>
      ["a", "b", "c"].flatMap((key, i) => {
        const start = year[`semester_${key}_start` as keyof AcademicYear];
        const end = year[`semester_${key}_end` as keyof AcademicYear];
        return typeof start === "string" &&
          typeof end === "string" &&
          start <= end
          ? [{ year, semester: ["א", "ב", "ג"][i] as Semester, start, end }]
          : [];
      }),
    )
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) || a.year.id.localeCompare(b.year.id),
    );
}
export function suggestTerm(
  years: AcademicYear[],
  today = institutionToday(),
): Term | null {
  const terms = availableTerms(years);
  // Inclusive boundaries. In vacations/exam periods choose the next published term.
  return (
    terms
      .filter((t) => t.start <= today && today <= t.end)
      .sort((a, b) => b.start.localeCompare(a.start))[0] ??
    terms.find((t) => t.start > today) ??
    null
  );
}
