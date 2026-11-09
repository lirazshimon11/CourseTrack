  # CourseTrack

CourseTrack is an independent academic schedule tracker, originally built as a personal project for studying at HIT (Holon Institute of Technology). It now supports separate student accounts and institution-specific academic calendars.

Institution calendars and administrator setup: [מדריך הפעלה ובדיקה בעברית](docs/calendar-setup.he.md).

Hebrew RTL course and lesson tracker built with Expo Router, React Native Web and Supabase.

## Features

- Course management and automatic lesson generation from weekly schedules and semester dates.
- Attendance tracking and notes for individual lessons.
- Hebrew RTL interface with the Heebo font.
- Email/password accounts with per-user data access enforced by Supabase RLS.
- Shared calendars organized by institution and academic year, with personal date overrides and excluded study dates.
- Administrator tools for institutions, calendars, synchronization review and connection diagnostics.
- A weekly calendar synchronization function on Vercel. The HIT adapter was validated against the live 2026–2027 calendar on 2026-11-06; its first publication and partial-day/special-schedule exceptions still require administrator review.

## Tech stack

React Native, Expo SDK 54, Expo Router, TypeScript, Supabase Auth/Postgres, AsyncStorage and date-fns. The web frontend and calendar API are deployed on Vercel. Expo also provides Android and iOS targets; the calendar synchronization API runs on Vercel.

## Local development

- `npm ci`
- `npm run web -- --port 8081`
- `npx tsc --noEmit`
- `npm run build`
- `npm test`

## Enable separate accounts (required before real use)

The client now supports email/password registration, email confirmation, persistent sign-in and sign-out. All routes are gated. Authenticated data screens stay closed until the database migration is installed. The public Supabase key in `lib/supabase.ts` is a client key, not an admin credential.

1. Back up the existing database. Run `supabase/migrations/202611050001_accounts.sql` in the existing project's Supabase SQL Editor as an administrator. It requires the existing `academic_years`, `courses`, and `sessions` tables. It replaces the old MVP policies, enables RLS, removes anonymous table access and sets new rows' owner to `auth.uid()`. Session ownership is inherited from the parent course. Course/year foreign keys should use ON DELETE CASCADE for course removal to remove related sessions.
2. In Supabase Auth, enable email/password sign-in and configure the Site URL and allowed confirmation redirect URLs for the local and deployed app. Keep email confirmation enabled for real users and configure production SMTP before inviting users.
3. Register the original owner's account and confirm the email. Verify its UUID in Auth > Users. Existing records intentionally retain a NULL owner; they are not given to the first person who registers.
4. To preserve the original personal data, replace the UUID below with the **verified original owner's UUID**, review the affected rows, then run as administrator. Do not assign the original data to a sibling or arbitrary first account:

```sql
begin;
update public.academic_years set user_id = 'VERIFIED_OWNER_UUID'::uuid where user_id is null;
update public.courses set user_id = 'VERIFIED_OWNER_UUID'::uuid where user_id is null;
commit;
```

5. Register the second account separately. It starts with no academic year or courses. Each account sets its own dates and courses.

## Account deletion

Run `supabase/migrations/202611090003_account_deletion.sql`, `supabase/migrations/202611090004_account_deletion_sessions.sql` and `supabase/migrations/202611090005_account_deletion_reviewers.sql` in Supabase SQL Editor. They add cascading deletion from the account to academic years, courses and sessions, and remove a deleted administrator's identity from shared sync logs; profiles, semester history and administrator membership already cascade from `auth.users`. Deploy `api/delete-account.mjs` with the Vercel app and configure the server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. The service role key must never be included in the app bundle. Web builds use the current site's `/api/delete-account` endpoint. Native builds must set `EXPO_PUBLIC_API_URL` to the deployed app origin when building. Users can request deletion in Settings > My account after typing “מחיקת החשבון”; the endpoint verifies their access token and deletes only that authenticated user.

Security model follows [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Acceptance checks after database setup

Use two separate browser profiles and two confirmed accounts (A and B):

- A creates an academic year, course and lesson note. Refresh preserves sign-in and data.
- B sees none of A's data, even when opening A's course URL directly.
- Using B's authenticated API client, reads/updates/deletes of A's IDs return no accessible rows; attempts to insert with A's user ID or A's year/course ID are denied by RLS.
- Anonymous API requests cannot read or mutate any of the three tables.
- B can create and edit its own year, course, attendance and notes.
- Sign out and switch accounts in the same browser: no previous account data remains visible.
- The delete-all control only removes the current user's courses and their sessions; the other account and academic year remain intact.
- Invalid calendar dates, reversed dates, missing semester dates and invalid lesson times display inline errors.

Run these acceptance checks against your deployed Supabase project after applying the migrations. Local automated tests cover the expected schema and RLS behavior using PGlite; they do not verify your production configuration.
