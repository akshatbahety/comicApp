# Developer — daily task log

One file, newest day on top. Add a `## YYYY-MM-DD` heading at the start of each working day, keep a checklist under it, carry unfinished items forward, never delete past days.

## 2026-11-22
- [x] F-010: Supabase project `panelforge` created (paused whiteboardink-dev for the slot)
- [x] Schema + RLS + private `comics` bucket (`supabase/migrations/`); security advisors clean
- [x] `SupabaseRepository`, `/login`, `src/proxy.ts`, sign-out, API 401 guard, Storage reference URLs
- [x] One-time import of localStorage comics
- [x] Verified redirects, 401s, RLS isolation, import, fal→Storage→panel pipeline
- [x] Owner turned off "Confirm email"; REST sign-up returns a session
- [x] UI: real 3-panel comic, regenerate from stored character, PNG export (AC-3, AC-4, AC-9)
- [ ] QA: delete from UI (AC-8), sign-up through the UI (AC-2)

- [x] Pushed F-016–F-018 and F-010 to GitHub (`main`)
- [x] F-011 slice: daily image quota (DB functions + API routes); verified limit, release, 429, no direct table access
- [x] `docs/deploy-vercel.md` setup guide
- [ ] Owner: import repo in Vercel + env vars; then set Supabase Site URL / redirect URLs
- [ ] Post-deploy smoke test on production (incl. delete, AC-8)

## 2026-11-21
- [x] Agent set up
- [x] F-016 facial features built (worktree 44b3044/0412682); lint + tsc clean; mock-mode ACs walked
- [x] F-017 script review built (worktree 43848ef); lint + tsc clean; AC-1–AC-15 walked in mock mode
- [x] F-018 language preference built (worktree 0239a2c); lint + tsc clean; AC-1–AC-11 walked in mock mode
- [x] Merged all three into main checkout; deduped checkText; script key now includes language; lint + tsc clean
- [x] Features F-016/F-017/F-018 set to in-qa
- [ ] Paid checks blocked: fal.ai rejects FAL_KEY (401), owner to replace key
