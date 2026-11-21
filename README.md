# Panelforge — AI comic generator

Turn an idea into comic panels: Claude writes a short script, an image model draws each panel, and everything you save lands in your library and on the dashboard. See [plan.md](plan.md) for the full MVP plan.

## Status

**Phase 1 (frontend with mocks) is done.** The whole flow works in the browser:

- **Create** (`/create`): prompt, style, panel count, aspect ratio, colour, tone, and an "Enhance with Claude" switch. With it on you can review and edit the script before panels are drawn. You can regenerate single panels, save, and download the page as a PNG.
- **Library** (`/library`, `/library/[id]`): saved generations and images, with search, style filters, sorting, remix and delete.
- **Dashboard** (`/`): total generations, images created, saved images, most used style, 7/14-day activity, images by style and recent generations.

Scripts and images are **mocks** for now: the "script" is a template and the images are drawn placeholder scenes. Data lives in the browser's `localStorage`.

## Run it

```powershell
npm install
npm run dev
```

Then open http://localhost:3000.

## Where things live

| Path | What |
|---|---|
| `src/lib/presets.ts` | Styles (prompt suffix + palette), panel counts, aspect ratios, colour modes, tones |
| `src/lib/types.ts` | `Generation`, `PanelImage`, `Script`, `DashboardStats` |
| `src/lib/data/` | `Repository` interface + `LocalRepository` (localStorage). **Phase 2:** add a Supabase implementation and swap it in `data/index.ts` |
| `src/lib/ai/` | `AIService` interface, prompt builder, guardrail check, mock provider. **Phase 3:** swap in a client that calls API routes (Claude + fal.ai) in `ai/index.ts` |
| `src/lib/generate.ts` | Runs a generation (parallel panels) and panel regeneration |
| `src/lib/stats.ts` | Dashboard numbers from raw records |
| `src/components/` | App shell, shared panel/grid components, create form, library cards; `ui/` is shadcn/ui |

**How the counts work:** one click of Generate is 1 generation. "Images created" counts every image ever drawn, including ones replaced by a panel regeneration. Deleting a generation removes it and its images from all totals.
