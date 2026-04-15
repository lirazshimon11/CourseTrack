import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Session, AttendanceStatus, SessionType } from '../types';
import { groupSessionsByWeek } from '../lib/dateUtils';

export function useSessions(courseId: string, type?: SessionType) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (!error && data) setSessions(data);
    setLoading(false);
  }, [courseId, type]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (!error && data) {
      setSessions(prev => prev.map(s => s.id === sessionId ? data : s));
    }
    return { error };
  };

  const updateAttendance = (sessionId: string, attendance: AttendanceStatus) =>
    updateSession(sessionId, { attendance });

  const updateNotes = (sessionId: string, notes: string) =>
    updateSession(sessionId, { notes });

  const grouped = groupSessionsByWeek(sessions);

  const attended = sessions.filter(s => s.attendance === 'attended');
  const missed = sessions.filter(s => s.attendance === 'missed');
  const unmarked = sessions.filter(s => s.attendance === null);

  return {
    sessions,
    grouped,
    attended,
    missed,
    unmarked,
    loading,
    updateAttendance,
    updateNotes,
    refetch: fetchSessions,
  };
}
