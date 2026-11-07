import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadInstitutionYears } from "../lib/loadInstitutionYears";
import { supabase } from "../lib/supabase";
import { AcademicYear } from "../types";
import { availableTerms, suggestTerm, Term } from "../lib/semesterContext";
export function useSemesterContext() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [override, setOverride] = useState<{
    yearId: string;
    semester: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadInstitutionYears(supabase);
      setInstitutionId(result.institutionId);
      setYears(result.years);
    } catch {
      setError(
        "לא ניתן לטעון או לשייך את הלוח לחשבון. בדקו את החיבור ועדכון מסד הנתונים.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const terms = availableTerms(years);
  const suggested = suggestTerm(years);
  const target = override
    ? (terms.find(
        (t) =>
          t.year.id === override.yearId && t.semester === override.semester,
      ) ?? null)
    : suggested;
  return {
    refresh,
    target,
    suggested,
    terms,
    loading,
    institutionId,
    error,
    selectTerm: (term: Term) =>
      setOverride({ yearId: term.year.id, semester: term.semester }),
    automatic: !override,
  };
}
