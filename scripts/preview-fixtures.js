// UI-only fixtures, never used in the application.
export const year = {
  id: "year",
  label: "תשפ״ז · 2026–2027",
  institution_id: "hit",
  calendar_id: "calendar",
  calendar_revision: 1,
  date_mode: "calendar",
  semester_a_start: "2026-10-18",
  semester_a_end: "2027-01-17",
  semester_b_start: "2027-02-21",
  semester_b_end: "2027-06-04",
  semester_c_start: "2027-07-11",
  semester_c_end: "2027-09-17",
  excluded_dates: ["2026-12-06"],
};
const data = {
  institutions: [{ id: "hit", slug: "hit", name: "HIT — מכון טכנולוגי חולון" }],
  institution_calendars: [
    {
      ...year,
      id: "calendar",
      start_year: 2026,
      revision: 1,
      origin: "sync",
      updated_at: "2026-11-06T10:00:00Z",
      notes: "",
    },
  ],
  academic_years: [year],
  student_profiles: {
    user_id: "demo",
    institution_id: "hit",
    active_academic_year_id: "year",
  },
  calendar_sources: [
    {
      id: "source",
      institution_id: "hit",
      page_url: "https://www.hit.ac.il/students/calender/",
      enabled: true,
      auto_publish_new_years: true,
      last_checked_at: "2026-11-06T10:00:00Z",
      last_success_at: "2026-11-06T10:00:00Z",
    },
  ],
  calendar_sync_runs: [
    {
      id: "run",
      source_id: "source",
      status: "review",
      created_at: "2026-11-06T10:00:00Z",
      message: "נמצאו ימי לימודים חלקיים הדורשים בדיקה.",
      candidate: {
        ...year,
        notes: "יום לימודים חלקי — יש לבדוק את שעות המפגשים מול המקור.",
      },
    },
  ],
};
export const supabase = {
  auth: {
    getUser: async () => ({
      data: { user: { id: "demo", email: "student@example.com" } },
    }),
    getSession: async () => ({ data: { session: null } }),
    signOut: async () => ({ error: null }),
  },
  rpc: async (name) => ({ data: name === 'export_my_courses' ? {format:'CourseTrack',version:1,exported_at:new Date().toISOString(),academic_years:[year],courses:[{id:'demo',name:'קורס לדוגמה',sessions:[{id:'demo-session',attendance:'attended',notes:'הערת דוגמה'}]}]} : name === "is_app_admin" && !location.search.includes("user=1"), error: null }),
  from(name) {
    const chain = new Proxy(
      {
        then: (fn) =>
          Promise.resolve({ data: data[name] ?? [], error: null }).then(fn),
      },
      { get: (t, k) => (k === "then" ? t.then : () => chain) },
    );
    return chain;
  },
};
