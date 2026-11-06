import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Course, Semester, AcademicYear, SlotData } from '../types';
import { generateSessions } from '../lib/dateUtils';

export function useCourses(academicYearId?: string | null) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    setLoading(true);
    let query = supabase.from('courses').select('*').order('order_index', { ascending: true });
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      setCourses(data as Course[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, [academicYearId]);

  const createCourse = async (
    name: string,
    semester: Semester,
    color: string,
    academicYearId: string | null,
    lectureSlots: SlotData[],
    exerciseSlots: SlotData[],
    academicYear: AcademicYear | null
  ) => {
    const nextOrder = courses.length > 0
      ? Math.max(...courses.map(c => c.order_index || 0)) + 1
      : 0;

    const slots_data = [
      ...lectureSlots.map(s => ({ ...s, type: 'lecture' as const })),
      ...exerciseSlots.map(s => ({ ...s, type: 'exercise' as const })),
    ];

    const { data: course, error: cErr } = await supabase
      .from('courses')
      .insert({ name, semester, color, order_index: nextOrder, academic_year_id: academicYearId, slots_data })
      .select()
      .single();

    if (cErr) return { error: cErr };

    if (academicYear) {
      const sessionObjects = generateSessions(course.id, slots_data, academicYear, semester);
      if (sessionObjects.length === 0) {
        await supabase.from('courses').delete().eq('id', course.id);
        return { error: new Error('לא נמצאו מפגשים בטווח התאריכים שנבחר') };
      }
      const { error: sessErr } = await supabase.from('sessions').insert(sessionObjects);
      if (sessErr) {
        await supabase.from('courses').delete().eq('id', course.id);
        return { error: sessErr };
      }
    }

    setCourses(prev => [...prev, course]);
    return { success: true, courseId: course.id };
  };

  const deleteCourse = async (courseId: string) => {
    // Sessions will be deleted automatically due to CASCADE if FK is set, 
    // but just in case or if no FK, we delete manually
    await supabase.from('sessions').delete().eq('course_id', courseId);
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) return { error };
    setCourses(prev => prev.filter(c => c.id !== courseId));
    return { success: true };
  };

  const updateCourse = async (
    id: string,
    name: string,
    semester: Semester,
    color: string,
    lectureSlots: SlotData[],
    exerciseSlots: SlotData[]
  ) => {
    try {
      const slots_data = [
        ...lectureSlots.map(s => ({ ...s, type: 'lecture' as const })),
        ...exerciseSlots.map(s => ({ ...s, type: 'exercise' as const })),
      ];

      const { error: cErr } = await supabase
        .from('courses')
        .update({ name, semester, color, slots_data })
        .eq('id', id);

      if (cErr) throw cErr;

      const { data: currentSessions, error: fetchSessErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('course_id', id);

      if (!fetchSessErr && currentSessions) {
        const newLectures = slots_data.filter(s => s.type === 'lecture').sort((a, b) => a.day_of_week - b.day_of_week);
        const newExercises = slots_data.filter(s => s.type === 'exercise').sort((a, b) => a.day_of_week - b.day_of_week);

        for (const sess of currentSessions) {
          const [sessY, sessM, sessD] = sess.date.split('-').map(Number);
          const sessDate = new Date(sessY, sessM - 1, sessD, 12, 0, 0);

          const sun = new Date(sessDate);
          sun.setDate(sessDate.getDate() - sessDate.getDay());

          const slotsOfThisType = sess.type === 'lecture' ? newLectures : newExercises;

          const weekSessions = currentSessions
            .filter(s => {
              const [sy, sm, sd] = s.date.split('-').map(Number);
              const sdDate = new Date(sy, sm - 1, sd, 12, 0, 0);
              const sdSun = new Date(sdDate);
              sdSun.setDate(sdDate.getDate() - sdDate.getDay());
              return s.type === sess.type && sdSun.getTime() === sun.getTime();
            })
            .sort((a, b) => a.date.localeCompare(b.date));

          const sessIndex = weekSessions.findIndex(s => s.id === sess.id);
          const matchingSlot = slotsOfThisType[sessIndex] || slotsOfThisType[0];

          if (matchingSlot) {
            const newDate = new Date(sun);
            newDate.setDate(sun.getDate() + matchingSlot.day_of_week);
            if (newDate.getHours() !== 12) newDate.setHours(12, 0, 0, 0);

            const yyyy = newDate.getFullYear();
            const mm = String(newDate.getMonth() + 1).padStart(2, '0');
            const dd = String(newDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            await supabase
              .from('sessions')
              .update({
                date: dateStr,
                start_time: matchingSlot.start_time,
                end_time: matchingSlot.end_time
              })
              .eq('id', sess.id);
          }
        }
      }

      await fetchCourses();
      return { success: true };
    } catch (err) {
      console.error('Update course error:', err);
      return { error: err };
    }
  };

  const deleteAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('נדרשת כניסה מחדש');
    const { error } = await supabase.from('courses').delete().eq('user_id', user.id);
    if (error) throw error;
    setCourses([]);
  };

  const reorderCourses = async (newOrderedCourses: Course[]) => {
    setCourses(newOrderedCourses);

    const updates = newOrderedCourses.map((c, i) => ({
      id: c.id,
      name: c.name,
      semester: c.semester,
      color: c.color,
      academic_year_id: c.academic_year_id,
      order_index: i
    }));

    try {
      const { error } = await supabase.from('courses').upsert(updates);
      if (error) throw error;
    } catch (error) {
      console.error('Reorder error:', error);
      fetchCourses();
    }
  };

  const moveCourse = async (id: string, direction: 'up' | 'down') => {
    const index = courses.findIndex(c => c.id === id);
    if (index === -1) return;

    const newCourses = [...courses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= courses.length) return;

    [newCourses[index], newCourses[targetIndex]] = [newCourses[targetIndex], newCourses[index]];

    await reorderCourses(newCourses);
  };

  const recreateSessions = async (courseId: string) => {
    // Fetch the latest course data directly to ensure we have the slots_data updated via SQL
    const { data: course, error: cErr } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (cErr || !course) return { error: 'Course not found' };
    if (!course.academic_year_id) return { error: 'Academic Year not linked' };

    const { data: ay, error: ayErr } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', course.academic_year_id)
      .single();

    if (ayErr) return { error: ayErr };

    const slots_data = course.slots_data || [];
    console.log(`Regenerating ${course.name} with ${slots_data.length} slots`);

    if (slots_data.length === 0) {
      return { error: 'No slots defined for this course. Please edit the course and add hours.' };
    }
    const sem = String(course.semester).trim();
    let startDateStr = ay.semester_a_start;
    let endDateStr = ay.semester_a_end;

    if (sem === 'ב') {
      startDateStr = ay.semester_b_start;
      endDateStr = ay.semester_b_end;
    } else if (sem === 'קיץ' || sem === 'ג') {
      startDateStr = ay.semester_c_start;
      endDateStr = ay.semester_c_end;
    }

    if (!startDateStr || !endDateStr) {
      return { error: `תאריכי סמסטר ${sem} לא מוגדרים במערכת עבור שנת הלימודים הזו. אנא הגדר אותם בהגדרות השנה האקדמית.` };
    }

    const newSessionObjects = generateSessions(courseId, slots_data, ay, course.semester);
    console.log(`Generated ${newSessionObjects.length} sessions using dates: ${startDateStr} to ${endDateStr}`);

    const { data: existingSessions, error: esErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('course_id', courseId);

    if (esErr) return { error: esErr };

    const { error: delErr } = await supabase.from('sessions').delete().eq('course_id', courseId);
    if (delErr) return { error: delErr };

    const finalSessions = newSessionObjects.map(newSess => {
      const match = existingSessions.find(oldS =>
        oldS.type === newSess.type &&
        oldS.session_number === newSess.session_number
      );
      if (match) {
        return {
          ...newSess,
          attendance: match.attendance,
          notes: match.notes,
          updated_at: match.updated_at
        };
      }
      return newSess;
    });

    if (finalSessions.length > 0) {
      const { error: insErr } = await supabase.from('sessions').insert(finalSessions);
      if (insErr) return { error: insErr };
    }

    await fetchCourses();
    return { success: true, count: finalSessions.length };
  };

  return {
    courses,
    loading,
    createCourse,
    deleteCourse,
    updateCourse,
    reorderCourses,
    moveCourse,
    deleteAllData,
    recreateSessions,
    refetch: fetchCourses
  };
}
