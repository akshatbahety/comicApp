# Comic Generator — MVP Plan

## 1. Goal

An AI comic generator focused on three core features:

1. **Generate** comic images with different options and styles.
2. **Save** generated images.
3. **Look back** at saved content (library / history).

Plus a **dashboard** showing total generations and total images created.

Everything else from the whiteboard (characters, storyboard, inspiration, sharing, browsing other comics, monetization) is **post-MVP** — the architecture should leave room for it, but we don't build it now.

## 2. Decisions

| Area | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui, comic-flavoured theme |
| Image generation | fal.ai (model chosen per style/quality) |
| Story / prompt help | Claude — turns a short idea into a mini-script + per-panel image prompts |
| Backend | Supabase (Postgres + Storage + Auth) — **built after the frontend** |
| Build order | Frontend first with a mock data layer, then swap in Supabase, then real AI |

## 3. Key concepts (data model)

These shapes are used by the frontend from day one (mocked), then become Supabase tables.

- **Generation** — one "Generate" click.
  `id, created_at, idea (user input), script (Claude output, optional), style, layout, panel_count, aspect_ratio, model, status (pending | done | failed), error`
- **Image (Panel)** — one image produced by a generation.
  `id, generation_id, panel_index, prompt, caption/dialogue, image_url, width, height, is_saved, created_at`
- **Dashboard stats** — derived: total generations, total images, saved images, images by style, generations over the last 7/30 days.

> "Generations" ≠ "images": one generation of a 4-panel comic = 1 generation, 4 images. The dashboard shows both.

## 4. Generation options (comic-focused)

- **Style presets** (each maps to a prompt suffix + recommended fal model):
  Classic American comic · Manga (B&W) · Webtoon (full colour) · Noir · Retro pop-art · Cartoon / kids · Watercolour storybook
- **Layout:** single panel · 3-panel strip · 4-panel grid · 6-panel page
- **Aspect ratio:** square, portrait, landscape (per panel)
- **Colour mode:** full colour · black & white · limited palette
- **Mood / tone:** funny, dramatic, action, wholesome, spooky
- **Enhance with Claude:** on/off toggle. On → idea is expanded into a script + consistent panel prompts. Off → user's prompt goes straight to the image model.
- **Negative prompt / guardrails:** built-in safety suffix + content filter (see §8).

## 5. User flow ("easy and happy flow")

1. **Create page:** type an idea ("a cat detective solves the mystery of the missing fish") → pick style, layout, options → *Generate*.
2. If Claude enhancement is on: show the generated **script** (panel-by-panel) — user can tweak text, then confirm.
3. Panels generate (with per-panel loading states); results show in the chosen comic layout with captions.
4. User can **regenerate a single panel**, **save** panels / the whole comic, or **download** as PNG.
5. Saved work appears in the **Library**; counts update on the **Dashboard**.

## 6. Pages / routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — stat cards (generations, images, saved), recent comics, quick "New comic" button, simple chart of activity |
| `/create` | Generator: idea input, options panel, script review, panel results |
| `/library` | Grid of saved comics/images; filter by style, sort by date, simple text search on idea/prompt |
| `/library/[id]` | One comic: full layout view, script, settings used, download, delete |
| `/settings` (later) | Account, API usage |

Shared layout: sidebar/topbar nav (Dashboard · Create · Library).

## 7. Architecture

```
app/                    Next.js routes (pages above + api/)
  api/generate/         POST → (Claude script) → fal image calls → persist
  api/enhance/          POST → Claude idea → script + panel prompts
components/
  comic/                ComicLayout, Panel, SpeechCaption
  create/               IdeaInput, StylePicker, OptionsPanel, ScriptEditor
  dashboard/            StatCard, ActivityChart, RecentComics
  ui/                   shadcn primitives
lib/
  styles.ts             style presets → prompt suffix + model
  types.ts              Generation, Image, Stats
  data/                 Repository interface + implementations
    repository.ts       interface: createGeneration, saveImage, listGenerations, getStats …
    mock-repo.ts        Phase 1 — in-memory/localStorage
    supabase-repo.ts    Phase 2
  ai/
    claude.ts           script/prompt enhancer
    fal.ts              image generation client
    mock-ai.ts          Phase 1 — returns placeholder images
```

**Key idea:** the UI only talks to the `Repository` and `ai` interfaces. Phase 1 uses mock implementations; later phases swap in Supabase and real AI without touching the UI.

API keys (fal, Anthropic, Supabase service key) live only on the server (`.env.local`, API routes) — never in the browser.

## 8. Guardrails

- Claude system prompt refuses/rewrites unsafe ideas (explicit, hateful, real-person defamation, minors in unsafe contexts) before any image call.
- Use fal's safety checker where the model supports it.
- Simple rate limit per user (e.g. N generations/hour) once auth exists.
- Cap panels per generation (max 6) to control cost.

## 9. Phased execution

### Phase 1 — Frontend with mocks
- Scaffold Next.js + TS + Tailwind + shadcn/ui; set comic theme (fonts, colours, panel borders).
- App shell + navigation.
- Types, style presets, mock repository (localStorage so data survives refresh), mock AI (placeholder images + fake script, simulated delay).
- Build Create page (options, script review, panel layouts, loading states, save, download).
- Build Library + comic detail page (filters, search, delete).
- Build Dashboard (stat cards, recent comics, activity chart).
- **Done when:** the full flow works end-to-end with fake images and the dashboard counts are correct.

### Phase 2 — Supabase backend
- Create project; tables `generations`, `images`; Storage bucket `comics`.
- Supabase Auth (email magic link or Google) + Row Level Security so users only see their own data.
- Implement `supabase-repo.ts`; stats via SQL view or RPC.
- **Done when:** data persists across devices/sessions per user.

### Phase 3 — Real AI
- `claude.ts`: idea → structured JSON script (panels with description, caption, dialogue) using a fast current Claude model.
- `fal.ts`: per-panel generation with the style's model + prompt suffix; consistent character description injected into every panel prompt.
- Download fal output and upload to Supabase Storage (fal URLs are temporary).
- Error handling, retries, single-panel regenerate.
- **Done when:** real comics generate, save, and show up in Library and Dashboard.

### Phase 4 — Polish
- Guardrails and rate limits, empty/error states, mobile layout, export full comic page as one PNG.

## 10. Post-MVP backlog (from the whiteboard)

Characters (reusable character sheets for consistency) · Storyboard editor · Inspiration gallery · Browse other users' comics · Content sharing (public links) · Monetization (credits/subscriptions).

## 11. Open questions (decide when we reach the phase)

- Which exact fal models per style (test a few for quality vs. speed vs. cost in Phase 3).
- Auth method for Phase 2 (magic link vs. Google).
- Render dialogue as HTML overlays on the image (crisp, editable) vs. baked into the image — **recommend overlays**.
