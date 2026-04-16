import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Session, AttendanceStatus, SessionType } from '../types';

export const useSessions = (courseId: string | undefined, type: SessionType) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('course_id', courseId)
      .eq('type', type)
      .order('session_number', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
    } else if (data) {
      setSessions(data);
    }
    setLoading(false);
  }, [courseId, type]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const updateAttendance = async (sessionId: string, attendance: AttendanceStatus) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, attendance } : s));
    const { error } = await supabase
      .from('sessions')
      .update({ attendance })
      .eq('id', sessionId);

    if (error) {
      fetchSessions();
      return { error };
    }
    return { success: true };
  };

  const updateNotes = async (sessionId: string, notes: string) => {
    const now = new Date().toISOString();
    console.log('--- START UPDATE NOTES ---');
    console.log('SessionID:', sessionId);
    console.log('Notes length:', notes.length);

    // Optimistic update
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, notes, updated_at: now } : s));
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ 
          notes, 
          updated_at: now 
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('SUPABASE ERROR:', error.message, error.details);
        fetchSessions(); // Rollback
        return { error };
      }
      
      if (!data) {
        console.warn('UPDATE SUCCESSFUL BUT NO DATA RETURNED - check RLS policies!');
        // Even if no data returned, if no error, it might have worked but we can't be sure
      }

      console.log('UPDATE COMPLETED SUCCESSFULLY:', data);
      
      if (data) {
        setSessions(prev => prev.map(s => s.id === sessionId ? data : s));
      }
      
      return { success: true, session: data || { id: sessionId, notes, updated_at: now } };
    } catch (e) {
      console.error('FATAL ERROR DURING UPDATE:', e);
      fetchSessions();
      return { error: e };
    }
  };

  return { sessions, loading, updateAttendance, updateNotes, refresh: fetchSessions };
};
