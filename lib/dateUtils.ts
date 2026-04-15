import { Session, ScheduleSlot, AcademicYear, Semester, SessionType } from '../types';

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

export function groupSessionsByWeek(sessions: Session[]) {
  const groups: { [key: string]: Session[] } = {};
  
  sessions.forEach(session => {
    const date = new Date(session.date);
    // Find the Sunday of the week
    const diff = date.getDate() - date.getDay();
    const sunday = new Date(date);
    sunday.setDate(diff);
    const weekKey = sunday.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    
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
  slots: ScheduleSlot[], 
  academicYear: AcademicYear, 
  semester: Semester
): Omit<Session, 'id' | 'created_at'>[] {
  const sessions: Omit<Session, 'id' | 'created_at'>[] = [];
  
  let startDateStr = academicYear.semester_a_start;
  let endDateStr = academicYear.semester_a_end;
  
  if (semester === 'ב') {
    startDateStr = academicYear.semester_b_start;
    endDateStr = academicYear.semester_b_end;
  } else if (semester === 'קיץ' || semester === 'ג') {
    startDateStr = academicYear.semester_c_start;
    endDateStr = academicYear.semester_c_end;
  }
  
  if (!startDateStr || !endDateStr) return [];
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  slots.forEach((slot) => {
    let current = new Date(start);
    // Adjust current to the first occurrence of slot.day_of_week
    while (current.getDay() !== slot.day_of_week) {
      current.setDate(current.getDate() + 1);
    }
    
    let weekNum = 1;
    while (current <= end) {
      sessions.push({
        course_id: courseId,
        slot_id: slot.id,
        type: slot.type as SessionType,
        date: current.toISOString().split('T')[0],
        start_time: slot.start_time,
        end_time: slot.end_time,
        week_number: weekNum,
        session_number: weekNum,
        attendance: null,
        notes: '',
        updated_at: null,
      });
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
  });
  
  return sessions;
}
