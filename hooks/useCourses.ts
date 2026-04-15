import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Course, ScheduleSlot, Semester } from '../types';
import { generateSessions } from '../lib/dateUtils';
import { AcademicYear } from '../types';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCourses(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const createCourse = async (
    name: string,
    semester: Semester,
    academicYearId: string,
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    academicYear: AcademicYear
  ) => {
    // 1. Create the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({ name, semester, academic_year_id: academicYearId })
      .select()
      .single();

    if (courseError || !course) return { error: courseError };

    // 2. Create schedule slots
    const allSlots = [
      ...lectureSlots.map(s => ({ ...s, course_id: course.id, type: 'lecture' as const })),
      ...exerciseSlots.map(s => ({ ...s, course_id: course.id, type: 'exercise' as const })),
    ];

    let savedSlots: ScheduleSlot[] = [];
    if (allSlots.length > 0) {
      const { data: slotsData, error: slotsError } = await supabase
        .from('schedule_slots')
        .insert(allSlots)
        .select();
      if (slotsError) return { error: slotsError };
      savedSlots = slotsData || [];
    }

    // 3. Generate all sessions for the semester
    const generatedSessions = generateSessions(course.id, savedSlots, academicYear, semester);
    if (generatedSessions.length > 0) {
      const { error: sessionsError } = await supabase
        .from('sessions')
        .insert(generatedSessions);
      if (sessionsError) return { error: sessionsError };
    }

    await fetchCourses();
    return { error: null, course };
  };

  const deleteCourse = async (courseId: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (!error) setCourses(prev => prev.filter(c => c.id !== courseId));
    return { error };
  };

  const deleteAllData = async () => {
    await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('schedule_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setCourses([]);
  };

  return { courses, loading, createCourse, deleteCourse, deleteAllData, refetch: fetchCourses };
}
