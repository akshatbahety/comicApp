# AI spend ledger

Budget: **up to $1 per day across all agents**, no approval needed below that. Every paid fal.ai or Claude API call gets a row (a Claude script is about $0.02). Estimates come from the cost figures in `src/lib/presets.ts`.

| Date | Agent | What | Est. cost (USD) | Day total |
|---|---|---|---|---|
| 2026-11-21 | qa | F-016 A-5: one POST /api/character, Draft (flux/schnell), to confirm the FAL_KEY 401. fal answered Unauthorized (route returned 502), so no image was made and most likely nothing was charged | 0.003 (upper bound) | 0.003 |
| 2026-11-22 | developer | F-010 checks: 1 character + 1 panel via API, one 3-panel Draft comic (character + 3 panels), 1 panel regenerate (all FLUX.2 Flash) | 0.07 | 0.07 |
| 2026-11-22 | developer | F-009 check: 2 Claude scripts (claude-opus-5-5, low effort): 3-panel English funny, 4-panel Japanese spooky | 0.04 | 0.11 |
