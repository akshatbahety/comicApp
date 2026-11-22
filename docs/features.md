# Features list

Owned by the **product-manager** agent. The developer agent moves items to `in-qa`; the QA agent moves them to `done` or back to `in-dev` and adds `BUG-###` rows.

**Status:** `idea` → `specced` → `in-dev` → `in-qa` → `done` (or `blocked`)
**Priority:** P0 must-have now · P1 next · P2 later

## Features

| ID | Feature | Priority | Status | Spec | Notes |
|---|---|---|---|---|---|
| F-001 | Create comic: idea, style, panel count, aspect ratio, colour, tone, quality tier | P0 | in-qa | — | Built in Phase 1 + fal.ai; needs a spec with a test plan |
| F-002 | Character-first generation: reference character, then each panel drawn from it | P0 | in-qa | — | `/api/character`, `/api/panels` |
| F-003 | Script review: "Enhance with Claude" toggle, edit script before drawing | P0 | in-qa | — | Script is still a template (no Claude call yet). Extended by F-017 |
| F-004 | Regenerate a single panel | P0 | in-qa | — | |
| F-005 | Save and download comic as PNG | P0 | in-qa | — | |
| F-006 | Library: search, style filter, sort, remix, delete | P0 | in-qa | — | `/library` |
| F-007 | Comic detail page | P0 | in-qa | — | `/library/[id]` |
| F-008 | Dashboard: generations, images, saved, top style, activity, recent | P0 | in-qa | — | `/` |
| F-009 | Real Claude script writing (idea → structured panel script) | P1 | in-dev | — | Built 2026-11-22: `POST /api/script` (`src/lib/ai/claude.ts`, claude-opus-5-5, structured output, server-side refusal fallback). Captions in chosen language, scenes in English. Needs `ANTHROPIC_API_KEY`; no per-user script quota yet (F-011) |
| F-010 | Supabase backend: auth, tables, storage, RLS | P1 | in-qa | [F-010](specs/F-010-supabase-backend.md) | Project `panelforge`. Email+password, owner-only RLS, private `comics` bucket, one-time local import. Shipping agent comes after this |
| F-011 | Guardrails and rate limits | P1 | in-dev | — | First slice built 2026-11-22: daily image quota (30/user, 300 site-wide, in `quota_settings`), reserved before every fal call, released on failure. Remaining: per-minute rate limit, UI showing images left |
| F-012 | Mobile layout polish and empty/error states | P2 | idea | — | plan.md Phase 4 |
| F-013 | Reusable characters library | P2 | idea | — | Post-MVP |
| F-014 | Storyboard editor | P2 | idea | — | Post-MVP |
| F-015 | Public share links / browse others' comics | P2 | idea | — | Post-MVP, needs F-010 |
| F-016 | Facial features (character look): hair style, hair colour, skin tone, facial hair, eyewear | P0 | in-qa | [F-016](specs/F-016-facial-features.md) | Preset IDs only; clause in character prompt; adds server-side prompt blocklist shared with F-017. Build first. QA 2026-11-21 ([report](../qa/reports/2026-11-21.html)): all mock/API/regression checks pass; stays in-qa only because paid check B-14/A-5 blocked by fal 401 (FAL_KEY). |
| F-017 | Script review before drawing: explicit switch, works with Enhance off, edits kept on Back, guardrail on edits | P0 | in-qa | [F-017](specs/F-017-script-review.md) | Extends F-003; depends on `checkText` from F-016. QA 2026-11-21 ([report](../qa/reports/2026-11-21.html)): all mock/API/regression checks pass; stays in-qa only because paid check B-17 blocked by fal 401 (FAL_KEY). See BUG-001, BUG-002. |
| F-018 | Language preference for captions/dialogue (en, es, fr, hi, ja), remembered default + per comic | P0 | in-qa | [F-018](specs/F-018-language-preference.md) | UI chrome translation out of scope; no text baked into images. QA 2026-11-21 ([report](../qa/reports/2026-11-21.html)): all mock/API/regression checks pass; stays in-qa only because paid check B-13 blocked by fal 401 (FAL_KEY). |
| F-019 | Paid plan: $10/month (Dodo Payments) for 30 images per billing period; paywall shown on "Approve and draw" / "Generate" | P0 | in-dev | [F-019](specs/F-019-paid-plan.md) | Built 2026-11-22. Live product `pdt_0NsVkQ6LJndbO61vaCoc6`. Enforced in `reserve_image` (402 `quota_unpaid`, 429 `quota_monthly`). Paywall switched off in prod (`require_subscription = false`) until deploy + Dodo/Supabase secret keys are set |

## Bugs

| ID | Bug | Severity | Feature | Status | Found in |
|---|---|---|---|---|---|
| BUG-001 | Long captions (100–140 chars, allowed by F-017) overflow the on-screen panel overlay when panels are small (375 px phone, ~1024 px desktop): first line cut off, box covers the panel number and the Regenerate button, which can no longer be clicked. PNG download is fine. Priority P0 | Major | F-017 (also F-018) | idea | [QA 2026-11-21](../qa/reports/2026-11-21.html) |
| BUG-002 | At ~1024 px viewport the review card's "Approve and draw N panels · ≈$X" button is wider than the card and overflows ~59 px left over the settings card (fine at 1280/1440/375). Priority P2 | Minor | F-017 | idea | [QA 2026-11-21](../qa/reports/2026-11-21.html) |
