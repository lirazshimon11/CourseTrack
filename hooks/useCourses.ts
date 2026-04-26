import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Course, Semester, ScheduleSlot, AcademicYear } from '../types';
import { generateSessions } from '../lib/dateUtils';

export function useCourses(academicYearId?: string | null) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    setLoading(true);
    let query = supabase
      .from('courses')
      .select('*, slots:schedule_slots(*)')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setCourses(data);
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
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    academicYear: AcademicYear | null
  ) => {
    // Get next order index
    const nextOrder = courses.length > 0 
      ? Math.max(...courses.map(c => c.order_index || 0)) + 1 
      : 0;

    const { data: course, error: cErr } = await supabase
      .from('courses')
      .insert({ name, semester, color, order_index: nextOrder, academic_year_id: academicYearId })
      .select()
      .single();

    if (cErr) return { error: cErr };

    // Insert slots
    const slotsToInsert = [
      ...lectureSlots.map(s => ({ ...s, course_id: course.id, type: 'lecture' })),
      ...exerciseSlots.map(s => ({ ...s, course_id: course.id, type: 'exercise' })),
    ];

    const { data: slots, error: sErr } = await supabase
      .from('schedule_slots')
      .insert(slotsToInsert)
      .select();

    if (sErr) return { error: sErr };

    // Generate sessions if academic year provides dates
    if (academicYear) {
      const sessionObjects = generateSessions(course.id, slots, academicYear, semester);
      const { error: sessErr } = await supabase.from('sessions').insert(sessionObjects);
      if (sessErr) {
        console.error('Session generation error:', sessErr);
      }
    }

    setCourses(prev => [...prev, course]);
    return { success: true, courseId: course.id };
  };

  const deleteCourse = async (courseId: string) => {
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
    lectureSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[],
    exerciseSlots: Omit<ScheduleSlot, 'id' | 'course_id'>[]
  ) => {
    try {
      // 1. Update basic course info
      const { error: cErr } = await supabase
        .from('courses')
        .update({ name, semester, color })
        .eq('id', id);

      if (cErr) throw cErr;

      // 2. Update slots: Delete old ones and insert new ones
      const { error: dErr } = await supabase
        .from('schedule_slots')
        .delete()
        .eq('course_id', id);

      if (dErr) throw dErr;

      const slotsToInsert = [
        ...lectureSlots.map(s => ({ ...s, course_id: id, type: 'lecture' })),
        ...exerciseSlots.map(s => ({ ...s, course_id: id, type: 'exercise' })),
      ];

      const { data: slots, error: sErr } = await supabase
        .from('schedule_slots')
        .insert(slotsToInsert)
        .select();

      if (sErr) throw sErr;

      // 3. Update existing sessions' times AND dates
      const { data: currentSessions, error: fetchSessErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('course_id', id);

      if (!fetchSessErr && currentSessions) {
        // Group new slots by type and sort by day to maintain consistent indexing
        const newLectures = slots.filter(s => s.type === 'lecture').sort((a, b) => a.day_of_week - b.day_of_week);
        const newExercises = slots.filter(s => s.type === 'exercise').sort((a, b) => a.day_of_week - b.day_of_week);

        for (const sess of currentSessions) {
          const sessDate = new Date(sess.date);
          // Find Sunday of the week this session is in
          const sun = new Date(sessDate);
          sun.setDate(sessDate.getDate() - sessDate.getDay());
          
          const slotsOfThisType = sess.type === 'lecture' ? newLectures : newExercises;
          
          // Determine which slot this session likely belongs to by its chronological index within that week
          const weekSessions = currentSessions
            .filter(s => s.type === sess.type && s.date >= sun.toISOString().split('T')[0] && s.date < new Date(sun.getTime() + 7 * 86400000).toISOString().split('T')[0])
            .sort((a, b) => a.date.localeCompare(b.date));
          
          const sessIndex = weekSessions.findIndex(s => s.id === sess.id);
          const matchingSlot = slotsOfThisType[sessIndex] || slotsOfThisType[0];

          if (matchingSlot) {
            const newDate = new Date(sun);
            newDate.setDate(sun.getDate() + matchingSlot.day_of_week);
            
            const yyyy = newDate.getFullYear();
            const mm = String(newDate.getMonth() + 1).padStart(2, '0');
            const dd = String(newDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            await supabase
              .from('sessions')
              .update({ 
                date: dateStr,
                start_time: matchingSlot.start_time, 
                end_time: matchingSlot.end_time,
                slot_id: matchingSlot.id
              })
              .eq('id', sess.id);
          }
        }
      }

      await fetchCourses();
      return { success: true };
    } catch (e) {
      console.error('Error updating course:', e);
      return { error: e };
    }
  };

  const deleteAllData = async () => {
    await supabase.from('courses').delete().neq('id', '0');
    setCourses([]);
  };

  const reorderCourses = async (newOrderedCourses: Course[]) => {
    // 1. Update local state immediately for responsiveness
    setCourses(newOrderedCourses);

    // 2. Prepare only the necessary fields for update
    // We only send id and order_index to avoid schema/constraint issues with joined data
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
      fetchCourses(); // Rollback if DB update fails
    }
  };

  const moveCourse = async (id: string, direction: 'up' | 'down') => {
    const index = courses.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const newCourses = [...courses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= courses.length) return;
    
    // Swap
    [newCourses[index], newCourses[targetIndex]] = [newCourses[targetIndex], newCourses[index]];
    
    await reorderCourses(newCourses);
  };

  const recreateSessions = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course || !course.academic_year_id) return { error: 'Course or Academic Year not found' };

    // 1. Fetch academic year details
    const { data: ay, error: ayErr } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', course.academic_year_id)
      .single();

    if (ayErr) return { error: ayErr };

    // 2. Fetch current slots
    const { data: slots, error: sErr } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('course_id', courseId);

    if (sErr) return { error: sErr };

    // 3. Generate new session objects
    const newSessionObjects = generateSessions(courseId, slots, ay, course.semester);

    // 4. Fetch existing sessions to preserve notes/attendance
    const { data: existingSessions, error: esErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('course_id', courseId);

    if (esErr) return { error: esErr };

    // 5. Delete old sessions
    await supabase.from('sessions').delete().eq('course_id', courseId);

    // 6. Map notes/attendance back to new sessions if they share the same session number and type
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

    // 7. Insert fixed sessions
    const { error: insErr } = await supabase.from('sessions').insert(finalSessions);
    
    if (insErr) return { error: insErr };
    
    return { success: true };
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
