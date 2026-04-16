export type Semester = 'א' | 'ב' | 'ג' | 'קיץ';
export type SessionType = 'lecture' | 'exercise';
export type AttendanceStatus = 'attended' | 'missed' | 'pending' | null;

export interface AcademicYear {
  id: string;
  label: string;
  semester_a_start: string | null;
  semester_a_end: string | null;
  semester_b_start: string | null;
  semester_b_end: string | null;
  semester_c_start: string | null;
  semester_c_end: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  semester: Semester;
  color: string;
  order_index: number;
  academic_year_id: string | null;
  created_at: string;
  slots?: ScheduleSlot[];
}

export interface ScheduleSlot {
  id: string;
  course_id: string;
  type: SessionType;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
}

export interface Session {
  id: string;
  course_id: string;
  slot_id: string | null;
  type: SessionType;
  date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  week_number: number;
  session_number: number;
  attendance: AttendanceStatus;
  notes: string;
  updated_at: string | null;
  created_at: string;
}

export interface CourseWithSlots extends Course {
  schedule_slots: ScheduleSlot[];
}

export interface GroupedSessions {
  weekNumber: number;
  weekLabel: string;
  sessions: Session[];
}
