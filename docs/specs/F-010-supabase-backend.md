# F-010 Supabase backend: auth, tables, storage, RLS

**Status:** in-qa · **Priority:** P1 · **Owner:** product-manager (spec), developer (build)

## Problem / goal

Comics lived only in one browser's localStorage, and images pointed at temporary fal.ai links. A user who signs in on any device should see their own comics: the panels, the character, the script/storyboard and the idea they typed.

## Scope

**In scope**
- Supabase project `panelforge` (ref `lticonipwzicvaruhsxd`, ap-south-1).
- Email + password sign-in and sign-up; sign-out in the sidebar.
- Every page needs sign-in (signed-out visitors go to `/login?next=…`).
- `/api/character` and `/api/panels` answer 401 to signed-out callers (they spend fal credits).
- Tables `characters`, `generations`, `panel_images` with owner-only row-level security.
- Private Storage bucket `comics`; every image is copied there under `{user_id}/…`.
- One-time import of comics saved in this browser before F-010.

**Out of scope**
- Google / magic-link sign-in, password reset UI, email confirmation (off for now; turn on with custom SMTP later).
- Public share links (F-015), reusable characters UI (F-013), Realtime sync between devices.

## Behaviour rules

- Owner-only: a user can read, create, change and delete only their own rows and files (RLS on tables and on `storage.objects`, keyed on `auth.uid()`). Signed-out (anon) role has no table grants.
- Images are fetched by the browser right after fal returns them and uploaded to `comics/{user_id}/{generation_id|characters}/{id}.{ext}`. The original fal URL is kept in `source_url` for reference only.
- The app displays images through signed URLs (1 h, reused for up to 50 min).
- Panel generation uses the character's signed Storage URL as the reference; `/api/panels` accepts fal.media URLs or signed URLs into this project's `comics` bucket.
- Deleting a comic deletes its rows (panel images cascade) and its panel files. Characters are kept (future reuse, F-013).
- Import: on first sign-in in a browser that has `panelforge:v1` data, every comic is copied into the account (idea, script, settings, saved flag, created date). Images that can't be fetched any more (expired fal links) are skipped and counted in the toast. Runs once per browser (`panelforge:imported`); local data is left untouched.

## Data and API impact

- Types: unchanged (`src/lib/types.ts`).
- Repository: new `SupabaseRepository` (`src/lib/data/supabase-repository.ts`) behind the existing `Repository` interface; `src/lib/data/index.ts` now uses it. `LocalRepository` stays for import.
- Auth: `@supabase/ssr`; `src/proxy.ts` (Next 16 rename of middleware) refreshes the session and redirects; `src/lib/supabase/{client,server}.ts`.
- Schema: `supabase/migrations/`.
- Architecture change needed? Yes, storage moves from the browser to Supabase. Done behind the existing interface, so views are unchanged.

## Acceptance criteria

- **AC-1** Signed out, any page redirects to `/login` (keeping `next`); `/login` redirects home when signed in.
- **AC-2** Sign up with email + password lands on the dashboard signed in (with "Confirm email" off in Supabase).
- **AC-3** A generated comic appears in the library after reload, sign-out/sign-in, and on another browser, with panels, character, idea, script and settings.
- **AC-4** Regenerating a panel works on a comic loaded from the database (reference = Storage URL).
- **AC-5** User B cannot see, change or upload into user A's rows or files.
- **AC-6** `POST /api/character` and `/api/panels` return 401 when signed out.
- **AC-7** Comics in localStorage from before F-010 are imported once on first sign-in; expired images are skipped with a count.
- **AC-8** Delete removes the comic and its panel files.
- **AC-9** Download PNG still works (signed URLs allow CORS).

## Test plan

Browser: AC-1–AC-4, AC-7–AC-9 with the QA accounts in `.env.local` (`QA_TEST_EMAIL`, `QA_TEST_EMAIL_2`). API/REST: AC-5 (user B token against REST and Storage), AC-6 (curl without cookies).

## Implementation notes

- 2026-11-22 (developer): built and partly verified.
  - **Verified:**
    - Redirects (AC-1).
    - 401 from both image routes (AC-6).
    - RLS isolation: user B sees no rows, can't list or upload into A's folder, and gets 403 inserting a row as A (AC-5).
    - Import of a seeded local comic, with the expired character image skipped (AC-7).
    - Detail page shows the prompt, script and settings loaded from Postgres.
    - The pieces of the real pipeline: signed-in `/api/character` → browser fetches fal image (CORS ok) → upload to `comics` → signed URL accepted by `/api/panels` → fal drew the panel.
    - Supabase security advisors: no findings.
    - UI run with a visible browser pane:
      - A real 3-panel Draft comic: the character and panels were saved to Storage and Postgres (AC-3).
      - After a reload, regenerating panel 1 used the stored character, and the old image was marked superseded (AC-4).
      - Signed panel URLs draw onto a canvas without tainting it, so PNG export works (AC-9).
  - **Not verified:** AC-8 (delete from the UI); the owner took over the browser pane. AC-2: on 2026-11-22 the owner turned "Confirm email" off; a fresh REST sign-up then returned a session at once (not yet clicked through in the UI).
  - "Confirm email" was on by default; the owner turned it off. QA accounts 1 and 2 were confirmed by SQL before that.
