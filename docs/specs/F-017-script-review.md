# F-017 Script review before drawing

**Status:** specced · **Priority:** P0 · **Owner:** product-manager · **Extends:** F-003

## Problem / goal

Users want to read and fix the script, meaning the title, the main character, each panel's scene and its caption, before any paid panel is drawn. Today that is only possible as a side effect of "Enhance with Claude". Edits are lost if the user steps back to change a setting, and edited text is never checked by the guardrail. This feature adds an explicit **Review script before drawing** option that works with Enhance on or off, and makes the review step safe and complete.

## What exists today (do not rebuild)

| Piece | Where | Today's behaviour |
|---|---|---|
| Enhance switch | `settings-form.tsx` | `settings.enhance`, default on. |
| Phases | `create-view.tsx` | `idle → scripting → review → drawing → done`. With Enhance on, Generate always goes to `review`. With Enhance off, it draws immediately with `script = null`. |
| Editor | `components/create/script-editor.tsx` | Edits the title, each panel's `scene` (textarea) and `caption` (input). Read-only mode shows scene and caption, but not the title or the main character. |
| Approve | Sidebar primary button in `review` | Label "Generate N images", which calls `draw(script)`. |
| Back | "Edit prompt or settings" | Sets `phase = "idle"`. The next primary click with Enhance on calls `writeScript` again, so **edits are discarded**. |
| Detail page | `library/[id]/detail-view.tsx` | `<ScriptEditor readOnly>` when `g.script` exists. The Details row "Script" shows `enhance ? "Claude" : "Prompt only"`. |
| Guardrail | `checkIdea(idea)` | Runs in the browser on the idea only. Edited script text is **not** checked. |

## Scope

**In scope (the delta)**
- A new **Review script before drawing** switch, stored as `settings.reviewScript`, independent of Enhance.
- **Enhance off with review on:** a basic script is built locally from the idea (no AI call) and opened for review.
- **Enhance on with review off:** the script is written and drawing starts straight away. The script is shown read-only.
- **Review step additions:**
  - an editable **Main character** field (`script.characters`),
  - per-field length limits and counters,
  - an empty-scene error,
  - **Approve and draw** and **Back to settings** buttons inside the script card,
  - a **Rewrite script** action, with a confirm when edits exist.
- **Edits survive Back.** The script is only rebuilt when the idea, the panel count or Enhance changed, and the user is warned first.
- **Guardrail on edited text,** client-side via `checkText` and server-side via the prompt check from F-016.
- **Detail page:**
  - the read-only script shows the title and main character,
  - the source label is correct,
  - the Details row gains a third value.

**Out of scope**
- **A separate dialogue field.** `ScriptPanel` keeps one `caption` string, relabelled **Caption or dialogue**. Splitting it would ripple into `PanelImage`, the overlay in `panel-figure.tsx` and the PNG download in `download.ts`.
- **Real Claude script writing.** That is F-009. The script still comes from the mock template.
- **Adding, removing or reordering panels in review.** Panel count is chosen in settings.
- **Editing the script or captions after drawing,** on Create or on the detail page.
- **Remix prefilling the script.** Remix still copies the idea and settings only. The script is rebuilt by the normal flow.

## User flow

1. On `/create`, directly under **Enhance with Claude**, there is a new switch: **Review script before drawing**, with the hint "See and edit every panel's text before anything is drawn". It is on by default.
2. The primary button label follows the matrix in Behaviour rules, e.g. "Write script", "Review script" or "Generate N images".
3. **Enhance on, review on** (default, same as today). Click **Write script**. The loading card reads "Claude is writing your script…". The review card opens.
4. **Enhance off, review on.** Click **Review script**. The review card opens immediately with no loading card. It holds the basic script:
   - title from the idea,
   - main character "the main character of: <idea>",
   - one camera-shot scene per panel,
   - empty captions.
5. **The review card** (`ScriptEditor`, editable) shows:
   - **Title** (≤ 80 characters),
   - **Main character**, a textarea of ≤ 300 characters with the hint "Used to design the reference character",
   - per panel: **Scene**, a textarea of ≤ 300 characters, and **Caption or dialogue**, an input of ≤ 140 characters,
   - a character counter on each field when it is within 20 characters of its limit.
6. The card footer has these buttons:
   - **Back to settings** (ghost),
   - **Rewrite script** (outline, shown only when Enhance is on),
   - **Approve and draw N panels · ≈$X** (primary).
   The sidebar primary button reads the same and does the same thing.
7. **Approve.** Validation runs (see Behaviour rules). If it passes, the phase moves to `drawing`, the script turns read-only and the panels draw as today. If it fails, the offending field gets a red border and an inline message, focus moves to the first invalid field, and nothing is drawn.
8. **Back to settings.** The form unlocks and the script stays visible, read-only, with the note "Your edited script is kept."
   - Pressing the primary button again reopens review **with the edits** if the idea, the panel count and Enhance are unchanged. Changes to style, tone, colour, quality, aspect or character look keep the script.
   - If any of those three changed, the script must be rebuilt. If the user had edited it, an AlertDialog asks "Replace your edited script? Your changes to the script will be lost." with **Replace** and **Keep editing**. **Replace** rebuilds the script and opens review. **Keep editing** closes the dialog and stays in `idle` with the old script kept, so the user can change the settings back. If there were no edits, the script is rebuilt with no dialog.
9. **Rewrite script** (Enhance on). If the script has edits, the same AlertDialog is shown, then `writeScript` runs again.
10. **Enhance on, review off.** **Generate N images** writes the script (loading card), then draws immediately. The script card is read-only throughout.
11. **Enhance off, review off.** Same as today: it draws immediately with no script.
12. **`/library/[id]`.** The read-only script card shows the title, "Main character: …" and every panel's scene and caption. Its description reads:
    - "Written by Claude" when `enhance` is true,
    - "Written from your prompt" when the script came from the basic builder.

Empty state: there is no review card until the user asks for one. The preview grid shows dashed placeholders as today.
Loading state: Enhance on uses the existing "Claude is writing your script…" card, and the primary button reads "Writing script…". The basic script has no loading state.
Error state:
- If `writeScript` fails, a toast is shown and the phase returns to `idle`. Any previously kept script is kept.
- Validation errors appear inline per field.
- A server 400 for a blocked prompt during drawing appears through the existing per-panel and character error states.

## Behaviour rules

- **Primary-button matrix** (idle phase):

  | Enhance | Review | Label | Action |
  |---|---|---|---|
  | on | on | Write script | `writeScript`, then `review` |
  | off | on | Review script | `basicScript`, then `review` |
  | on | off | Generate N images | `writeScript`, then draw immediately |
  | off | off | Generate N images | draw with `script = null` (today) |

  In `review` the label is always "Approve and draw N panels". While working it is "Writing script…" or "Drawing panels…", as today.
- **Default and legacy.** For new comics, `reviewScript` defaults to `true`. For comics without the field (all existing ones), treat it as equal to `enhance`, which matches what happened. Remix copies the stored value, or the legacy-derived one.
- **Basic script.** `basicScript(idea, settings)` is a new function in `src/lib/ai/prompts.ts`. It returns:
  - `title: titleFromIdea(idea)`,
  - `characters: "the main character of: " + idea.trim()`,
  - `panels[i] = { scene: shotFor(panelCount, i), caption: "" }`.
  If drawn unedited, the panel and character prompts are identical to the Enhance-off, no-script prompts of today.
- **Source label.** The script source is derived. If `settings.enhance` is true the source is "Claude". If it is false and `script` is non-null, the source is "Your prompt". If `script` is null, it is "Prompt only". The detail Details row **Script** shows these three values. A second row **Reviewed** shows "Yes" or "No" from `reviewScript`, with the legacy rule above.
- **Validation on approve:**
  - Values are trimmed first.
  - **Title:** may be empty, and then falls back to `titleFromIdea(idea)`. Maximum 80 characters.
  - **Main character:** may be empty, and then falls back to the existing `characterDescription` fallback. Maximum 300 characters.
  - **Scene:** required. Empty gives the error "Describe what happens in panel N." Maximum 300 characters.
  - **Caption:** optional. Maximum 140 characters.
  - Limits are enforced with `maxLength` on the inputs and re-checked on approve.
- **Guardrail on edited text.**
  - Every non-empty title, main character, scene and caption is run through `checkText`, the shared blocklist from F-016. A hit marks that field with "That text isn't something we can generate." and blocks drawing.
  - The server-side `parseImageRequest` check from F-016 is the backstop for scenes and the main character, which reach prompts.
  - Captions never reach the image model (they are HTML overlays), but they are checked anyway because they are shown and downloaded.
  - **Dependency.** If F-016 is not merged yet, implement `checkText` and the server check here as specified in F-016.
- **Dirty tracking.** The script counts as "edited" if any field differs from the version last produced by `writeScript` or `basicScript`.
- **Script key.** Store a key `idea.trim() | panelCount | enhance` with the script when it is produced. A mismatch on the next primary click means the script must be rebuilt (step 8 of the flow).
- **Panel count.** The script's panel count must equal `settings.panelCount` before drawing. The script key guarantees this.
- **Persistence.** The approved script is stored on `Generation.script`, as today, including when it came from `basicScript`. `PanelImage.caption` is copied from it at draw time, as today. `reviewScript` is stored in `GenerationSettings`.
- **No change** to:
  - regenerate panel (it uses the stored `generation.script`),
  - dashboard counts (a review creates no generation; the generation is created on approve, as today),
  - cost (review spends no fal credits).
- **Guardrails** (plan.md §8): panel caps are unchanged (`MAX_PANELS = 4`). The safety checker stays on. Review never calls fal.
- **Prompt length.** The longest scene (300 characters) plus the fixed reference text plus the style stays under 900 characters. The longest main character (300 characters) plus the F-016 clause plus the fixed text stays under 1000 characters. Both are under the API's 2000 limit.

## Data and API impact

- **Types (`src/lib/types.ts`):** add `reviewScript?: boolean` to `GenerationSettings`. `Script` and `ScriptPanel` are unchanged.
- **Presets (`src/lib/presets.ts`):** add `SCRIPT_LIMITS = { title: 80, characters: 300, scene: 300, caption: 140 }`.
- **Prompts (`src/lib/ai/prompts.ts`):**
  - Add `basicScript()` and `validateScript(script, idea): Record<string, string>`. It returns field-path → message, e.g. `"panels.1.scene"`, and the result is empty when valid.
  - Reuse `checkText` from F-016.
- **Repository:** no change.
- **AI service / API routes:** no new routes. `parseImageRequest` gains the `checkText` 400 (owned by F-016).
- **UI:**
  - `settings-form.tsx`: new switch.
  - `create-view.tsx`:
    - add a `scriptKey` and an "edited" state,
    - follow the new primary matrix,
    - make Back keep the script,
    - add the Replace confirm (reuse `components/ui/alert-dialog.tsx`),
    - set `DEFAULT_SETTINGS.reviewScript = true`,
    - make Remix apply the legacy rule.
  - `script-editor.tsx`:
    - add the Main character field, the limits, the counters and the error display (`errors` prop),
    - add an optional footer with `onApprove`, `onBack`, `onRewrite`, `approveLabel`,
    - the read-only view shows the title, the main character and a `sourceLabel` prop.
  - `detail-view.tsx`: three-value Script row, Reviewed row, and pass `sourceLabel`.
- **Architecture change needed?** No.

## Acceptance criteria

- **AC-1** `/create` shows a **Review script before drawing** switch under Enhance, on by default.
- **AC-2** The primary label and action follow the matrix for all four Enhance × Review combinations.
- **AC-3** Enhance off with review on opens review immediately, with no loading card. It shows N scenes equal to today's camera shots and empty captions.
- **AC-4** For an idea with no leading or trailing spaces, drawing an unedited basic script produces the same `character.prompt` and `images[].prompt` values as Enhance off with review off for the same idea and settings.
- **AC-5** Review shows editable Title, Main character, and per-panel Scene and Caption or dialogue fields with limits of 80, 300, 300 and 140 characters.
- **AC-6** An edited scene and main character appear in the stored `images[].prompt` and `character.prompt`, and the edited captions appear on the panels.
- **AC-7** An empty scene blocks drawing with "Describe what happens in panel N." on that field. No generation is created; `generations.length` is unchanged.
- **AC-8** A blocked word in any script field blocks drawing with an inline error. No generation is created and no fal request is made.
- **AC-9** Back to settings keeps the edited script. Reopening with the same idea, panel count and Enhance restores the edits without rewriting. Changing only style, tone or quality also keeps them.
- **AC-10** Changing the panel count, the idea or Enhance after editing shows the Replace confirm. **Replace** rebuilds the script and **Keep editing** keeps the old one. With no edits, the script is rebuilt with no dialog.
- **AC-11** **Rewrite script** with edits asks for confirmation first. Without edits it rewrites directly.
- **AC-12** Enhance on with review off writes the script and draws without stopping. The stored generation has a script.
- **AC-13** `/library/[id]` shows the read-only script with the title, the main character, and every scene and caption. The source reads "Written by Claude" or "Written from your prompt". The Details list shows Script (Claude / Your prompt / Prompt only) and Reviewed (Yes / No).
- **AC-14** Comics made before this build show Reviewed = Yes when `enhance` was true and No otherwise, and render without errors.
- **AC-15** The review step adds no generations or images to dashboard counts until it is approved.

## Test plan

Run browser checks in **mock mode** (`NEXT_PUBLIC_AI_MODE=mock`, restart the dev server) unless marked `[paid]`. Read stored data from localStorage key `panelforge:v1`.

### Browser checks
| # | Route | Steps | Expected |
|---|---|---|---|
| B-1 | `/create` | Load the page. | The "Review script before drawing" switch is under Enhance and is on. (AC-1) |
| B-2 | `/create` | Toggle through all four Enhance × Review combinations and read the primary label each time. | Write script / Review script / Generate 4 images / Generate 4 images. (AC-2) |
| B-3 | `/create` | Enhance off, review on, 3 panels, idea "A robot learns to paint". Click Review script. | Review opens instantly with no "Claude is writing" card. The scenes are "Wide establishing shot", "Medium action shot" and "Close-up reaction shot". Captions are empty. Main character is "the main character of: A robot learns to paint". (AC-3, AC-5) |
| B-4 | (from B-3) | Approve without edits. Read storage. In a new run with Enhance off and review off, same idea and settings, read storage again. | The `characters[].prompt` and each `images[].prompt` match between the two runs. (AC-4) |
| B-5 | `/create` | Enhance on, review on. Write script. Change panel 2's scene to "The robot spills blue paint on the cat", set panel 2's caption to "Oops.", and set the main character to "a small silver robot with one wheel". Approve. | Panel 2 shows the overlay "Oops.". The stored `images[1].prompt` contains "spills blue paint on the cat", and `characters[].prompt` contains "small silver robot with one wheel". (AC-6) |
| B-6 | `/create` review | Type past each limit. | Input stops at 80, 300, 300 and 140 characters. A counter appears near each limit. (AC-5) |
| B-7 | `/create` review | Clear panel 1's scene. Note `generations.length`. Approve. | The inline error "Describe what happens in panel 1." appears and focus moves to it. Nothing draws and `generations.length` is unchanged. (AC-7) |
| B-8 | `/create` review | Set panel 3's caption to "naked truth". Approve. Then restore it, put "gore" in the title, and approve again. | Each time the field shows "That text isn't something we can generate." and nothing draws. (AC-8) |
| B-9 | `/create` review | Edit panel 1's scene. Click Back to settings. Change Style and Tone. Click the primary button. | Review reopens with the edited scene and no rewrite happens. (AC-9) |
| B-10 | `/create` review | Edit a caption. Back. Change Panels from 4 to 3. Click primary. Choose Keep editing. Then click primary again and choose Replace. | The dialog appears both times. Keep editing leaves the old 4-panel script. Replace yields a fresh 3-panel script. (AC-10) |
| B-11 | `/create` review | Without editing: Back, change the idea, click primary. | The script is rebuilt with no dialog. (AC-10) |
| B-12 | `/create` review (Enhance on) | Edit a field, then click Rewrite script. Then, with no edits, click Rewrite script. | First a confirm appears, then a new script. The second time it rewrites directly. (AC-11) |
| B-13 | `/create` | Enhance on, review off. Click Generate. | The "Writing script…" card appears, then drawing starts with no review stop. The script card is read-only. The stored generation has a `script`. (AC-12) |
| B-14 | `/library/[id]` | Open the B-5 comic and the B-4 comic. | Both show the read-only script with the title and main character. B-5 reads "Written by Claude", Script: Claude, Reviewed: Yes. B-4 reads "Written from your prompt", Script: Your prompt, Reviewed: Yes. (AC-13) |
| B-15 | `/library/[id]` | Open a comic made before this build, both an Enhance-on one and an Enhance-off one (or remove `reviewScript` from a stored generation in the console). | Reviewed shows Yes and No respectively. No errors. (AC-14) |
| B-16 | `/` dashboard | Note the counts. Open review on `/create`, then leave without approving. Return to `/`. | The counts are unchanged. (AC-15) |
| B-17 `[paid]` | `/create` (fal mode) | Quality **Draft**, **3** panels, Enhance off, review on, idea "A dog delivers mail". Change panel 3's scene to "The dog proudly holds a red envelope in its mouth" and add the caption "Special delivery!". Approve. Log about $0.033 in `docs/ai-spend.md`. | Panel 3 visibly shows the dog holding a red envelope, with the caption overlay "Special delivery!". There is no lettering baked into the art. Record with a screenshot. |

### API checks
There are no new routes. These verify the backstop for edited text and the existing validation. None reach fal.

| # | Request | Body | Expected status / shape |
|---|---|---|---|
| A-1 | `POST /api/panels` | `{"prompt":"Create a new illustration… The hero is naked on stage.","aspectRatio":"1:1","quality":"low","panelIndex":1,"referenceUrl":"https://v3.fal.media/files/x.jpg"}` | `400 {"error":"That prompt isn't something we can generate."}` |
| A-2 | `POST /api/character` | `{"prompt":"Character design: a single full-body view of a porn star","aspectRatio":"1:1"}` | `400`, same error. |
| A-3 | `POST /api/panels` | `{"prompt":"   ","aspectRatio":"1:1","panelIndex":0,"referenceUrl":"https://v3.fal.media/files/x.jpg"}` | `400 {"error":"prompt must be 1–2000 characters"}`. An empty scene can never reach fal. |
| A-4 | `POST /api/panels` | A valid prompt with `"panelIndex":-1`, then `"panelIndex":"two"` | `400` "panelIndex must be 0–3" for both. |
| A-5 | `POST /api/panels` | A valid prompt with no `referenceUrl` | `400` "referenceUrl must be a fal.media image URL". |

### Regression checks
- Create → save → appears in Library → dashboard counts update → delete → counts drop.
- Enhance off with review off draws exactly as before, with no script on the detail page and the Details row Script reading "Prompt only".
- Regenerating a single panel on a reviewed comic keeps the edited caption and scene (mock: the `images[i].prompt` of the new image contains the edited scene).
- Start over during review clears the script and returns to idle.
- Download PNG of a reviewed comic includes the edited captions.
- Remix of a reviewed comic prefills the idea and settings, including `reviewScript`. The script is rebuilt by the normal flow, not prefilled.
- The idea guardrail (`checkIdea`) still runs before writing or building the script.

Checks that spend fal.ai credits are marked `[paid]`. Total for this spec is about $0.033 (B-17).

## Open questions

These were decided by PM without asking the owner. The owner can override them.
- **Review on by default.** It matches today's Enhance-on behaviour and spends nothing.
- **One combined field.** "Caption or dialogue" stays a single field rather than separate caption and speech fields.
- **No post-draw editing.** Editing captions after drawing, and on the detail page, is deferred (candidate for F-014, Storyboard editor).
- **Remix and the script.** Remix does not carry the script over.

## Implementation notes

_Filled in by the developer agent: files changed, architecture changes and why, how to test._

Built on branch worktree-agent-afed7239283dc12d8 (43848ef), merged 2026-11-21. Files: prompts.ts (basicScript, finalizeScript, validateScript; reuses F-016 checkText), presets.ts (SCRIPT_LIMITS), types.ts (reviewScript?), settings-form.tsx (switch), script-editor.tsx (main character, limits, inline errors, Approve/Back/Rewrite), create-view.tsx (Enhance × Review matrix, kept edits via script key, Replace dialog), detail-view.tsx (Script/Reviewed rows). Architecture change: none. Merge change: the script key now includes language, so changing caption language discards/asks to replace a kept script. Paid B-17 blocked (fal 401).
