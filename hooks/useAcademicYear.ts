import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AcademicYear } from '../types';

export function useAcademicYear() {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchYear = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!error && data) setAcademicYear(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchYear(); }, [fetchYear]);

  const saveYear = async (year: Omit<AcademicYear, 'id' | 'created_at'>) => {
    if (academicYear) {
      const { data, error } = await supabase
        .from('academic_years')
        .update(year)
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
