import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AcademicYear } from '../types';
import { useFocusEffect } from 'expo-router';

export function useAcademicYear() {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchYear = useCallback(async (foreground=true) => {
    if(foreground)setLoading(true);
    const [profileResult, yearsResult] = await Promise.all([
      supabase.from('student_profiles').select('active_academic_year_id').maybeSingle(),
      supabase
      .from('academic_years')
      .select('*')
      .order('created_at', { ascending: false }),
    ]);
    if (!yearsResult.error) {
      const years = yearsResult.data as AcademicYear[];
      const activeId = profileResult.data?.active_academic_year_id;
      setAcademicYear(activeId ? years.find((year) => year.id === activeId) ?? null : years[0] ?? null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void fetchYear(); const timer=setInterval(()=>void fetchYear(false),60000); return ()=>clearInterval(timer); }, [fetchYear]));

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
