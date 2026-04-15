import { format, addDays, startOfWeek, eachWeekOfInterval, parseISO, isValid, getDay, isSameDay } from 'date-fns';
import { Semester, AcademicYear, ScheduleSlot, Session } from '../types';

export const HEBREW_DAYS_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEBREW_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

export function getSemesterRange(year: AcademicYear, semester: Semester): { start: Date; end: Date } | null {
  let startStr: string | null = null;
  let endStr: string | null = null;

  if (semester === 'א') {
    startStr = year.semester_a_start;
    endStr = year.semester_a_end;
  } else if (semester === 'ב') {
    startStr = year.semester_b_start;
    endStr = year.semester_b_end;
  } else if (semester === 'ג') {
    startStr = year.semester_c_start;
    endStr = year.semester_c_end;
  }

  if (!startStr || !endStr) return null;

  const start = parseISO(startStr);
  const end = parseISO(endStr);

  if (!isValid(start) || !isValid(end)) return null;

  return { start, end };
}

export function generateSessions(
  courseId: string,
  slots: ScheduleSlot[],
  year: AcademicYear,
  semester: Semester
): Omit<Session, 'id' | 'created_at'>[] {
  const range = getSemesterRange(year, semester);
  if (!range) return [];

  const { start, end } = range;
  const sessions: Omit<Session, 'id' | 'created_at'>[] = [];
  const lectureCounter: { [slotId: string]: number } = {};
  const exerciseCounter: { [slotId: string]: number } = {};
  let lectureTotal = 0;
  let exerciseTotal = 0;

  const lectureSlots = slots.filter(s => s.type === 'lecture');
  const exerciseSlots = slots.filter(s => s.type === 'exercise');

  // Enumerate week by week from start to end
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });

  weeks.forEach((weekStart, weekIndex) => {
    const weekNumber = weekIndex + 1;

    lectureSlots.forEach(slot => {
      // Find the date in this week matching day_of_week
      const targetDate = addDays(weekStart, slot.day_of_week);
      if (targetDate >= start && targetDate <= end) {
        lectureTotal++;
        sessions.push({
          course_id: courseId,
          slot_id: slot.id,
          type: 'lecture',
          date: format(targetDate, 'yyyy-MM-dd'),
          start_time: slot.start_time,
          end_time: slot.end_time,
          week_number: weekNumber,
          session_number: lectureTotal,
          attendance: null,
          notes: '',
        });
      }
    });

    exerciseSlots.forEach(slot => {
      const targetDate = addDays(weekStart, slot.day_of_week);
      if (targetDate >= start && targetDate <= end) {
        exerciseTotal++;
        sessions.push({
          course_id: courseId,
          slot_id: slot.id,
          type: 'exercise',
          date: format(targetDate, 'yyyy-MM-dd'),
          start_time: slot.start_time,
          end_time: slot.end_time,
          week_number: weekNumber,
          session_number: exerciseTotal,
          attendance: null,
          notes: '',
        });
      }
    });
  });

  return sessions;
}

export function formatHebrewDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (!isValid(date)) return dateStr;
  const dayOfWeek = getDay(date); // 0=Sunday
  const dayName = HEBREW_DAYS_SHORT[dayOfWeek];
  const formatted = format(date, 'd.M.yyyy');
  return `יום ${dayName} ${formatted}`;
}

export function formatTime(time: string): string {
  return time.substring(0, 5); // "HH:MM:SS" → "HH:MM"
}

export function groupSessionsByWeek(sessions: Session[]) {
  const grouped: { [week: number]: Session[] } = {};

  sessions.forEach(session => {
    if (!grouped[session.week_number]) {
      grouped[session.week_number] = [];
    }
    grouped[session.week_number].push(session);
  });

  return Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map(weekNum => ({
      weekNumber: weekNum,
      sessions: grouped[weekNum].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));
}

export function getSessionLabel(session: Session): string {
  const type = session.type === 'lecture' ? 'הרצאה' : 'תרגול';
  return `${type} ${session.session_number}`;
}
