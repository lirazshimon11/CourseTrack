# CourseTrack

Institution calendars and administrator setup: [מדריך הפעלה ובדיקה בעברית](docs/calendar-setup.he.md).

Hebrew RTL course and lesson tracker built with Expo Router, React Native Web and Supabase.

## Local development

- `npm ci`
- `npm run web -- --port 8081`
- `npx tsc --noEmit`
- `npm run build`

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

The database migration and live two-account checks require administrative access and were not executed by the local implementation. No production data was changed.
