import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AcademicYear } from '../types';
import { useFocusEffect } from 'expo-router';

export function useAcademicYear() {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchYear = useCallback(async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('student_profiles').select('active_academic_year_id').maybeSingle();
    let query = supabase
      .from('academic_years')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (profile?.active_academic_year_id) query = query.eq('id', profile.active_academic_year_id);
    const { data, error } = await query.maybeSingle();
    if (!error) setAcademicYear(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchYear(); }, [fetchYear]));

  const saveYear = async (year: Omit<AcademicYear, 'id' | 'created_at'>) => {
    if (academicYear) {
      const { data, error } = await supabase
        .from('academic_years')
        .update({ ...year, date_mode: 'manual' })
        .eq('id', academicYear.id)
        .select()
        .single();
      if (!error && data) setAcademicYear(data);
      return { error };
    } else {
      const { data, error } = await supabase
        .from('academic_years')
        .insert(year)
        .select()
        .single();
      if (!error && data) setAcademicYear(data);
      return { error };
    }
  };

  return { academicYear, loading, saveYear, refetch: fetchYear };
}
