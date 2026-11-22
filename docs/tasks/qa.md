# QA — daily task log

One file, newest day on top. Add a `## YYYY-MM-DD` heading at the start of each working day, keep a checklist under it, carry unfinished items forward, never delete past days.

## 2026-11-22
- [x] Finished remaining checks (guardrail regressions, Start over, remix rules, mobile 375, PNG wrap, F-016 B-12 with all five pickers)
- [x] Report qa/reports/2026-11-21.html (run started 2026-11-21) + index.html updated - Not ready: 75 pass / 0 fail / 4 blocked / 0 skipped
- [x] Logged BUG-001 (Major, long captions cover Regenerate button) and BUG-002 (Minor, Approve button overflow at ~1024 px) in docs/features.md
- [x] F-016/F-017/F-018 left at in-qa with notes (only the paid checks are blocked)
- [x] Restored .env.local (checksum matches original)
- [ ] Re-run paid checks F-016 B-14/A-5, F-017 B-17, F-018 B-13 once FAL_KEY works (~$0.10)
- [ ] Dev server on :3000 was not started by QA; stop request was denied; not listening at end of run - confirm nothing left running
- [ ] Remove leftover panelforge:prefs ({"language":"hi"}) and QA mock comics from the browser profile if the owner wants a clean state

## 2026-11-21
- [x] Agent set up
- [x] Confirmed fal.ai still rejects FAL_KEY (one Draft /api/character call, fal 401 -> route 502); logged in docs/ai-spend.md
- [x] API checks for F-016, F-017, F-018 (21 requests, mock-independent)
- [x] Browser checks F-016 / F-017 / F-018 in mock mode (finished 2026-11-22)
- [x] Core regression flow (create -> save -> Library -> dashboard -> delete)
- [ ] HTML report, bugs, statuses -> carried to 2026-11-22
- [ ] Clean up -> carried to 2026-11-22
