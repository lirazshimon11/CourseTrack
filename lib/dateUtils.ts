import { Session, SlotData, AcademicYear, Semester, SessionType } from '../types';

export function formatHebrewDate(dateStr: string) {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
  const datePart = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return {
    full: `${dayName} ${datePart}`,
    dayName,
    datePart
  };
}

export function getHebrewDayName(dayIdx: number): string {
  const days = ['יום א\'', 'יום ב\'', 'יום ג\'', 'יום ד\'', 'יום ה\'', 'יום ו\'', 'שבת'];
  return days[dayIdx];
}

function parseDateSafely(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  // Try ISO format first (YYYY-MM-DD)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    }
  }

  // Try DD.MM.YYYY format
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts[2].length === 4) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
    }
  }

  // Fallback to native constructor if format is unknown
  const d = new Date(dateStr);
  d.setHours(12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export function groupSessionsByWeek(sessions: Session[]) {
  const groups: { [key: string]: Session[] } = {};

  sessions.forEach(session => {
    const [y, m, d] = session.date.split('-').map(Number);
    // Create date at noon to avoid DST jumps shifting the day
    const date = new Date(y, m - 1, d, 12, 0, 0);

    // Find the Sunday of the week (day 0)
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());

    const weekY = sunday.getFullYear();
    const weekM = String(sunday.getMonth() + 1).padStart(2, '0');
    const weekD = String(sunday.getDate()).padStart(2, '0');
    const weekKey = `${weekD}.${weekM}.${weekY}`; // Fix uniqueness

    if (!groups[weekKey]) groups[weekKey] = [];
    groups[weekKey].push(session);
  });

  // Sort sessions within each week by number
  Object.values(groups).forEach(weekSessions => {
    weekSessions.sort((a, b) => a.session_number - b.session_number);
  });

  return Object.entries(groups)
    .sort((a, b) => {
      // Sort weeks chronologically
      const dateA = a[1][0].date;
      const dateB = b[1][0].date;
      return dateA.localeCompare(dateB);
    })
    .map(([week, data]) => ({
      weekNumber: week,
      sessions: data
    }));
}

export function generateSessions(
  courseId: string,
  slots: SlotData[],
  academicYear: AcademicYear,
  semester: Semester
): Omit<Session, 'id' | 'created_at'>[] {
  const sessions: Omit<Session, 'id' | 'created_at'>[] = [];

  const sem = String(semester).trim();
  let startDateStr = academicYear.semester_a_start;
  let endDateStr = academicYear.semester_a_end;

  if (sem === 'ב') {
    startDateStr = academicYear.semester_b_start;
    endDateStr = academicYear.semester_b_end;
  } else if (sem === 'קיץ' || sem === 'ג') {
    startDateStr = academicYear.semester_c_start;
    endDateStr = academicYear.semester_c_end;
  }

  if (!startDateStr || !endDateStr) return [];

  const start = parseDateSafely(startDateStr);
  const end = parseDateSafely(endDateStr);

  if (!start || !end) {
    console.error(`Invalid dates: start=${startDateStr}, end=${endDateStr}`);
    return [];
  }

  slots.forEach((slot) => {
    let current = new Date(start);

    while (current.getDay() !== slot.day_of_week) {
      current.setDate(current.getDate() + 1);
    }

    let weekNum = 1;
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (current.getDay() === slot.day_of_week) {
        sessions.push({
          course_id: courseId,
          type: slot.type as SessionType,
          date: dateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          week_number: weekNum,
          session_number: weekNum,
          attendance: null,
          notes: '',
          updated_at: null,
        });
        weekNum++;
      }

      current.setDate(current.getDate() + 7);
      if (current.getHours() !== 12) {
        current.setHours(12, 0, 0, 0);
      }
    }
  });

  return sessions;
}
