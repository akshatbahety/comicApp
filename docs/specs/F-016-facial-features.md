# F-016 Facial features for the main character

**Status:** specced · **Priority:** P0 · **Owner:** product-manager

## Problem / goal

Today the main character's look is left entirely to the model and to the idea text. Users who want a specific look, such as "curly red hair, glasses, beard", have to fit it into the prompt and hope it sticks. This feature adds a small set of preset look choices on `/create`. The choices go into the character reference prompt, so every panel drawn from that reference inherits them. Choices are stored with the comic, so the detail page shows them and Remix reuses them.

## Scope

**In scope**
- A "Character look" section on `/create` with five preset pickers: **Hair style, Hair colour, Skin tone, Facial hair, Eyewear**. Every picker defaults to **Any**.
- The chosen options turn into one fixed clause in the character reference prompt (`buildCharacterPrompt`).
- The choices persist on the generation's settings and on the character record.
- The choices show on `/library/[id]` and carry over on Remix.
- A server-side blocklist check on every image prompt (shared guardrail, see Behaviour rules). This is also used by F-017.

**Out of scope**
- **Free-text look fields of any kind.** All values are closed preset IDs.
- **Expression.** The panel prompt explicitly asks for "New pose and expression" in each panel, so a fixed expression would be overridden every time. Panels get their expression from the scene text.
- **Face shape and eye colour.** The reference is a full-body figure at 1024 px, so these details come out tiny and unreliable. They can be revisited with F-013 (characters library), which could add a close-up head shot.
- **Age, gender, body type and ethnicity pickers.** These are content-policy sensitive and not requested.
- **Multiple characters.** The pickers apply to the main character only, the one drawn as the reference.
- **Showing the choices on Library cards or using them in Library search.**
- **Adding look text to the per-panel prompt.** Panels inherit the look through the reference image. The comment in `prompts.ts` warns that extra sentences in the `withReference` panel prompt get lettered into the art.

## User flow

1. The user opens `/create`. Below **Tone** there is a collapsible section headed **Character look**, collapsed by default. The header shows a summary: "Any" when nothing is set, otherwise the count, e.g. "3 set".
2. The user expands it and sees the hint "Works best when the main character is a person." There are five `Select` controls in a 2-column grid (one column at phone width). Each shows "Any" first, then its options, and each has a visible label.
3. The user picks, for example, Hair style "Curly", Hair colour "Red" and Eyewear "Round glasses". The summary reads "3 set". A **Reset** text button appears and sets all five back to Any.
4. The user clicks the primary button. The flow is unchanged: write script, review, draw (or draw directly with Enhance off). The cost line under the button does not change, because no extra image calls are made.
5. The reference character is drawn with the chosen look. Every panel is drawn from that reference.
6. On `/library/[id]`, the **Details** list has a **Character look** row, e.g. "Curly hair · Red hair · Round glasses". The row is omitted when every value is Any.
7. **Remix** from the detail page opens `/create` with the same five choices preselected and the section expanded if any are set.

Empty state: every picker shows "Any". The prompt is identical to today's, byte for byte.
Loading state: while scripting or drawing, the section is disabled along with the rest of the form (it lives inside the existing `<fieldset disabled>`).
Error state: there are no new error states in the UI. If a stored or remixed value is unknown (for example, localStorage was hand-edited), it is silently treated as Any. A server-side 400 for a blocked prompt surfaces through the existing toast and the error card on the character.

## Behaviour rules

- **Option lists.** These are fixed and live in `src/lib/presets.ts` as `FACE_FEATURES`. Each option is `{ id, name, prompt }`. "Any" is the absence of the key, not an option. Option IDs are the kebab-case of the name, as shown in brackets in the table, e.g. `curly`, `round-glasses`.

  | Group (`key`) | Options: name → prompt fragment |
  |---|---|
  | Hair style (`hairStyle`) | Short [`short`] → `short hair` · Shoulder-length [`shoulder-length`] → `shoulder-length hair` · Long [`long`] → `long hair` · Curly [`curly`] → `curly hair` · Ponytail [`ponytail`] → `hair in a ponytail` · Braids [`braids`] → `braided hair` · Bald [`bald`] → `bald head` |
  | Hair colour (`hairColour`) | Black [`black`] → `black hair` · Brown [`brown`] → `brown hair` · Blonde [`blonde`] → `blonde hair` · Red [`red`] → `red hair` · Grey [`grey`] → `grey hair` · Blue [`blue`] → `blue hair` · Pink [`pink`] → `pink hair` |
  | Skin tone (`skinTone`) | Light [`light`] → `light skin tone` · Medium [`medium`] → `medium skin tone` · Tan [`tan`] → `tan skin tone` · Brown [`brown`] → `brown skin tone` · Deep [`deep`] → `deep brown skin tone` |
  | Facial hair (`facialHair`) | Clean-shaven [`clean-shaven`] → `clean-shaven` · Stubble [`stubble`] → `light stubble` · Moustache [`moustache`] → `a moustache` · Beard [`beard`] → `a full beard` |
  | Eyewear (`eyewear`) | Round glasses [`round-glasses`] → `round glasses` · Square glasses [`square-glasses`] → `square-framed glasses` · Sunglasses [`sunglasses`] → `sunglasses` |

- **Skin tone wording.** Skin tone names describe tone only. No ethnicity, nationality or race words appear in names or prompts. The UI shows a small swatch next to each skin-tone name.
- **Prompt clause.** `featuresClause(face)` joins the fragments of the set keys in the table order with `", "` and returns `Face and look: <fragments>.`, or `""` when nothing is set. Example: `Face and look: curly hair, red hair, round glasses.`
- **Where the clause goes.** `buildCharacterPrompt` inserts it directly after the first sentence (`Character design: a single full-body view of …. `) and before the pose sentence. Nothing else in the prompt changes.
- **Panel prompts are unchanged.** `buildPanelPrompt` is not modified. Panels inherit the look from the reference image.
- **Conflicts.** If the idea or script `characters` text says "blonde" and the picker says "Red", the picker wins in practice: the clause is explicit and comes after the description. No conflict detection is done.
- **Monochrome and Manga.** Colour choices (hair colour, skin tone) are still sent. They render as tonal values, and the pickers are not disabled. The section hint does not mention it.
- **Bald with a hair colour.** Both fragments are sent. No cross-validation is done.
- **Normalisation.** `normalizeFace(input: unknown): FacialFeatures | undefined` keeps only known keys whose value is a known option ID. It returns `undefined` when nothing is left. It is applied:
  - when Remix prefills settings in `create-view.tsx`,
  - inside `buildCharacterPrompt` before building the clause, so a tampered stored record can never inject text.
- **Persistence.** On create, `settings.face` holds the normalised choice, or is absent when all are Any. The same value is copied onto `Character.face` in `createCharacter` in `src/lib/generate.ts`. Comics saved before this feature have no `face` field and behave exactly as they do today.
- **Regenerate panel.** No change. It reuses the stored character image. For legacy comics without a character, `regeneratePanel` draws one from `generation.settings`, which includes `face` if present.
- **Dashboard.** No change. The look adds no generations or images.
- **Guardrails** (plan.md §8):
  - **No free text.** The look adds no free text, so there is nothing for `checkIdea` to miss. The idea itself is still checked as today.
  - **Server-side prompt screening (new, shared with F-017).** Export the existing `BLOCKED` regex test from `src/lib/ai/prompts.ts` as `checkText(text): string | null`, with no minimum length. `checkIdea` keeps its 3-character rule and calls `checkText`. `parseImageRequest` in `src/lib/ai/request.ts` calls `checkText(prompt)` and returns `400 { error: "That prompt isn't something we can generate." }` before any fal call. This covers `/api/character` and `/api/panels`.
  - **Safety checker and caps.** fal's safety checker stays on. Panel caps are unchanged (`MAX_PANELS = 4`, `PANEL_COUNTS = [3, 4]`).
  - **Cost.** Unchanged: one character call plus N panel calls.
- **Prompt length.** The longest clause is under 140 characters, so the character prompt stays well under the 2000-character API cap.

## Data and API impact

- **Types (`src/lib/types.ts`):**
  - Add `FacialFeatures = Partial<{ hairStyle: HairStyleId; hairColour: HairColourId; skinTone: SkinToneId; facialHair: FacialHairId; eyewear: EyewearId }>`. The ID types are derived from `FACE_FEATURES` in `presets.ts`.
  - Add the optional `face?: FacialFeatures` to `GenerationSettings` and to `Character`.
- **Presets (`src/lib/presets.ts`):** add `FACE_FEATURES`, the ID types, `normalizeFace()` and `describeFace(face): string`. `describeFace` returns the `" · "`-joined option names, used by the detail page.
- **Prompts (`src/lib/ai/prompts.ts`):**
  - Add `featuresClause(face)`.
  - `buildCharacterPrompt` inserts the clause.
  - Add `checkText()`, and make `checkIdea` reuse it.
- **Generate (`src/lib/generate.ts`):** `createCharacter` passes `face: normalizeFace(settings.face)` into `repo.createCharacter`.
- **Repository (`src/lib/data/`):** no interface change. `NewCharacter` picks up the optional field automatically, and `LocalRepository` stores whatever it is given.
- **AI service / API routes:**
  - No new routes and no request-shape change. The look reaches the server only as part of `prompt`.
  - `parseImageRequest` gains the `checkText` 400. Mock mode is unaffected: it never calls the routes.
- **UI:**
  - `src/components/create/settings-form.tsx`: new section. Use the existing `Select`. A plain button with `aria-expanded` is enough for the collapse, so no new shadcn component is needed.
  - `src/app/create/create-view.tsx`: Remix calls `normalizeFace`. `DEFAULT_SETTINGS` gets no `face`.
  - `src/app/library/[id]/detail-view.tsx`: add the **Character look** row to `details` when `describeFace(s.face)` is non-empty.
- **Architecture change needed?** No.

## Acceptance criteria

- **AC-1** `/create` shows a collapsible **Character look** section with exactly five labelled pickers. The groups and options match the Behaviour rules table, and each picker defaults to "Any".
- **AC-2** The collapsed header shows "Any" when nothing is set and "N set" otherwise. **Reset** returns all five pickers to Any.
- **AC-3** With all pickers on Any, the stored `character.prompt` is identical to the prompt built before this feature for the same idea, script and settings.
- **AC-4** With options set, the stored `character.prompt` contains `Face and look: ` followed by the selected fragments in table order. It sits after the "Character design" sentence and before "Standing in a neutral three-quarter pose".
- **AC-5** No stored `PanelImage.prompt` contains `Face and look`.
- **AC-6** The generation's `settings.face` and the character's `face` hold the chosen IDs. Neither has a `face` key when everything is Any.
- **AC-7** `/library/[id]` shows a **Character look** row with the option names joined by " · " when any are set. There is no such row when none are set, and none for comics made before this feature.
- **AC-8** Remix prefills the same five choices. An unknown stored ID, e.g. `"hairColour": "green"` or `"eyeColour": "blue"`, is dropped to Any and does not appear in the next prompt.
- **AC-9** `POST /api/character` and `POST /api/panels` return `400` with `{ error: "That prompt isn't something we can generate." }` when the prompt matches the blocklist, and no fal request is made.
- **AC-10** The section is disabled while scripting, reviewing and drawing, like the rest of the form.
- **AC-11** The cost estimate under the primary button is unchanged by any look choice.
- **AC-12** At 375 px width the pickers stack in one column with no horizontal scroll.

## Test plan

Run browser checks in **mock mode** unless marked `[paid]`. To enable it, set `NEXT_PUBLIC_AI_MODE=mock` in `.env.local` and restart `npm run dev`. To read stored data, use DevTools → Application → Local Storage → key `panelforge:v1`, or `JSON.parse(localStorage["panelforge:v1"])` in the console.

### Browser checks
| # | Route | Steps | Expected |
|---|---|---|---|
| B-1 | `/create` | Load the page. Find **Character look**. | Collapsed, summary "Any". Expanding it shows Hair style, Hair colour, Skin tone, Facial hair and Eyewear, each set to "Any", and the hint about people. (AC-1) |
| B-2 | `/create` | Open each picker. | The options match the spec table exactly. Skin tone options show a swatch and use tone names only. (AC-1) |
| B-3 | `/create` | Set Curly, Red and Round glasses. Then click Reset. | The summary reads "3 set", then "Any" after Reset, and all pickers show Any. (AC-2) |
| B-4 | `/create` | Set Curly, Red and Round glasses. Enter "A librarian finds a secret door". Generate with Enhance on and approve the script. When done, read `panelforge:v1`. | The newest `characters[]` entry's `prompt` contains `Face and look: curly hair, red hair, round glasses.` between "Character design…" and "Standing in a neutral…". Its `face` is `{hairStyle:"curly",hairColour:"red",eyewear:"round-glasses"}`. The generation's `settings.face` matches. (AC-4, AC-6) |
| B-5 | (same data as B-4) | Inspect the new generation's `images[].prompt`. | None contains "Face and look". (AC-5) |
| B-6 | `/create` | Leave all pickers on Any. Generate any idea and read storage. | `characters[].prompt` has no "Face and look". `settings` and the character have no `face` key. (AC-3, AC-6) |
| B-7 | `/library/[id]` of the B-4 comic | Open it. | The Details list shows "Character look: Curly hair · Red hair · Round glasses". (AC-7) |
| B-8 | `/library/[id]` of the B-6 comic and of any comic made before this build | Open each. | No Character look row. The page renders without errors. (AC-7) |
| B-9 | `/library/[id]` of B-4 → Remix | Click Remix. | `/create` has the idea and settings prefilled. Character look is expanded with Curly, Red and Round glasses selected. (AC-8) |
| B-10 | `/create?from=<id>` | In the console, edit the B-4 generation in `panelforge:v1` so `settings.face = {hairColour:"green", eyeColour:"blue", eyewear:"monocle", hairStyle:"curly"}`, save it back, then open Remix. Generate and read the new character prompt. | Only Curly is preselected and the others are Any. The new prompt contains `Face and look: curly hair.` and no "green", "blue" or "monocle". (AC-8) |
| B-11 | `/create` | Click Generate and watch the form while drawing. | All Character look pickers are disabled until drawing finishes. (AC-10) |
| B-12 | `/create` | Note the "≈$" cost line. Set all five pickers. | The cost line is unchanged. (AC-11) |
| B-13 | `/create` at 375×812 | Expand the section. | Single column, no horizontal page scroll. (AC-12) |
| B-14 `[paid]` | `/create` (fal mode) | Quality **Draft**, **3** panels, Enhance on, idea "A baker opens a tiny shop". Set Hair style Long, Hair colour Blue, Eyewear Sunglasses. Generate and approve. Log about $0.033 in `docs/ai-spend.md`. | The reference character visibly has long blue hair and sunglasses. All 3 panels show the same look. Draft quality may be loose: record pass/partial with screenshots. |

### API checks
None of these reach fal except A-5. Invalid inputs fail validation first.

| # | Request | Body | Expected status / shape |
|---|---|---|---|
| A-1 | `POST /api/character` | `{"prompt":"Character design: a naked hero","aspectRatio":"1:1","quality":"low"}` | `400 {"error":"That prompt isn't something we can generate."}` (AC-9) |
| A-2 | `POST /api/panels` | `{"prompt":"a gore scene","aspectRatio":"1:1","quality":"low","panelIndex":0,"referenceUrl":"https://v3.fal.media/files/x.jpg"}` | `400`, same error. (AC-9) |
| A-3 | `POST /api/character` | `{"prompt":"x".repeat(2001),"aspectRatio":"1:1"}` | `400 {"error":"prompt must be 1–2000 characters"}` (existing) |
| A-4 | `POST /api/character` | `{"prompt":"ok","aspectRatio":"2:1"}`, then `{"prompt":"ok","aspectRatio":"1:1","quality":"ultra"}`, then the body `not json` | `400` "Unknown aspectRatio", then `400` "Unknown quality", then `400` "Invalid JSON body". (existing) |
| A-5 `[paid]` | `POST /api/character` | `{"prompt":"Character design: a single full-body view of a gardener. Face and look: curly hair, grey hair, a full beard. Standing in a neutral three-quarter pose, centered, plain white background. friendly cartoon illustration, textless.","aspectRatio":"1:1","quality":"low"}` | `200 {url, width:1024, height:1024, model:"fal-ai/flux/schnell", requestId}`, and the image shows curly grey hair and a beard. About $0.003. Log it. |
| A-6 | `POST /api/panels` | `{"prompt":"a hero","aspectRatio":"1:1","quality":"low","panelIndex":0,"referenceUrl":"https://example.com/x.jpg"}`, then the same with `"panelIndex":4` | `400` "referenceUrl must be a fal.media image URL", then `400` "panelIndex must be 0–3". (existing) |

### Regression checks
- Create → save → appears in Library → dashboard counts update → delete → counts drop.
- Enhance off: the comic draws with no script and the character prompt is unchanged (all Any).
- Regenerate a single panel on a B-4 comic (mock): it reuses the same character. There is no new `characters[]` entry and the panel prompt is unchanged.
- An idea containing a blocked word is still rejected client-side by `checkIdea` with the existing toast.
- An idea shorter than 3 characters still gives "Describe your idea in a few words first."
- The detail page of a comic saved before this build renders with all existing Details rows.

Checks that spend fal.ai credits are marked `[paid]`. Total for this spec is about $0.036 (B-14 plus A-5).

## Open questions

These were decided by PM without asking the owner. The owner can override them.
- **Set of five.** It drops expression, face shape and eye colour; the reasons are in Out of scope.
- **Skin tone names.** The five tone names are Light, Medium, Tan, Brown and Deep, with no ethnicity terms.
- **Facial hair for every character.** It is offered regardless of character, with no gender picker.
- **Mono and Manga.** Colour choices are still sent in these modes.
- **Where the look lives.** It is stored per comic. Saving a look as a reusable character belongs to F-013 (P2).

## Implementation notes

_Filled in by the developer agent: files changed, architecture changes and why, how to test._

Built on branch worktree-agent-a359ad6388bc6d559 (44b3044, 0412682), merged into main checkout 2026-11-21. Files: presets.ts (FACE_FEATURES, normalizeFace, faceOptions, describeFace), types.ts (FacialFeatures, face?), prompts.ts (featuresClause, shared checkText used by checkIdea), ai/index.ts, request.ts (blocklist 400 before fal), generate.ts, settings-form.tsx (CharacterLook), create-view.tsx (Remix normalises face), detail-view.tsx (Character look row). Architecture change: none. Detail labels use capitalised prompt fragments ("Curly hair · Red hair") to match B-7. Paid checks B-14/A-5 blocked: fal returned 401 for FAL_KEY.
