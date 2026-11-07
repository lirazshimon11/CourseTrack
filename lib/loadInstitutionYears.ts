import { AcademicYear } from "../types";
import { suggestTerm } from "./semesterContext";
// Read shared data first: a saved institution is not proof that a calendar exists.
// Repair only a missing personal copy, never re-adopt over an existing manual override.
export async function loadInstitutionYears(db: any) {
  const profile = await db
    .from("student_profiles")
    .select("institution_id")
    .maybeSingle();
  if (profile.error) throw profile.error;
  const institutionId = profile.data?.institution_id ?? null;
  if (!institutionId)
    return {
      institutionId,
      years: [] as AcademicYear[],
      sharedAvailable: false,
    };
  const [personal, shared] = await Promise.all([
    db.from("academic_years").select("*").eq("institution_id", institutionId),
    db
      .from("institution_calendars")
      .select("*")
      .eq("institution_id", institutionId),
  ]);
  if (personal.error) throw personal.error;
  if (shared.error) throw shared.error;
  let years = personal.data as AcademicYear[];
  const recommended = suggestTerm(shared.data);
  if (
    !suggestTerm(years) &&
    recommended &&
    !years.some((y) => y.calendar_id === recommended.year.id)
  ) {
    const adopted = await db.rpc("adopt_institution_calendar", {
      p_calendar_id: recommended.year.id,
    });
    if (adopted.error) throw adopted.error;
    const updated = await db
      .from("academic_years")
      .select("*")
      .eq("institution_id", institutionId);
    if (updated.error) throw updated.error;
    years = updated.data;
  }
  return { institutionId, years, sharedAvailable: !!recommended };
}
