import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AcademicYear } from '../types';

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

  // Reload only when this hook mounts. Returning from another app should not
  // blank the screen and re-fetch the same year; callers can use refetch when
  // they have actually changed academic settings.
  useEffect(() => { void fetchYear(); }, [fetchYear]);

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
