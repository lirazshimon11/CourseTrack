import { AcademicYear } from '../types';

export interface Institution { id: string; slug: string; name: string }
export interface InstitutionCalendar extends AcademicYear {
  institution_id: string; start_year: number; revision: number;
  origin: 'manual' | 'sync'; source_url: string | null; notes: string; updated_at: string;
}
export interface CalendarSource {
  id: string; institution_id: string; page_url: string; enabled: boolean;
  auto_publish_new_years: boolean; last_checked_at: string | null; last_success_at: string | null;
}
export interface CalendarRun {
  id: string; source_id: string; status: string; message: string; created_at: string;
  candidate: InstitutionCalendar | null;
}
export interface StudentProfile {
  user_id: string; institution_id: string | null; active_academic_year_id: string | null;
  degree: string; track: string; specialization: string; student_status: string;
  goal: string; english_level: string; study_year: string;
}
export const profileFields = [
  ['track', 'מסלול'], ['degree', 'תואר'], ['specialization', 'התמחות'],
  ['student_status', 'סטטוס'], ['goal', 'מטרה'], ['english_level', 'רמת אנגלית'], ['study_year', 'שנת לימוד'],
] as const;
export function calendarDates(c: AcademicYear) {
  return ['a','b','c'].map((sem,i) => {
    const start = c[`semester_${sem}_start` as keyof AcademicYear];
    const end = c[`semester_${sem}_end` as keyof AcademicYear];
    return `${['סמסטר א׳','סמסטר ב׳','קיץ'][i]}: ${start && end ? `${start} — ${end}` : 'לא הוגדר'}`;
  }).join('\n');
}
export function editableDates(c: AcademicYear) {
  return { label:c.label,semester_a_start:c.semester_a_start,semester_a_end:c.semester_a_end,
    semester_b_start:c.semester_b_start,semester_b_end:c.semester_b_end,semester_c_start:c.semester_c_start,
    semester_c_end:c.semester_c_end,excluded_dates:c.excluded_dates ?? [] };
}
