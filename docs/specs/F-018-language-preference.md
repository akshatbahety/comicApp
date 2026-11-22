# F-018 Language preference for captions and script

**Status:** specced · **Priority:** P0 · **Owner:** product-manager

## Problem / goal

Every caption and line of dialogue is in English today. Users who want their comic in their own language have no option. This feature lets the user pick a language for the script's captions and dialogue. The choice is remembered as their default and stored on each comic, so the detail page shows it and Remix reuses it. Image prompts stay in English and text is never baked into the art.

## Scope

**In scope**
- A **Caption language** picker on `/create` with five languages: **English, Español, Français, हिन्दी (Hindi), 日本語 (Japanese)**.
- **Remembered default:** the last language the user picked, per browser.
- **Per-comic setting:** `settings.language`.
- The script writer (`ai.writeScript`) returns captions in the chosen language. In mock mode this means translated canned lines.
- Caption overlays and the PNG download render the chosen script correctly. This includes line-wrapping for Japanese, which has no spaces, and a `lang` attribute for correct fonts and screen readers.
- A **Language** row on `/library/[id]`. Remix reuses the comic's language.

**Out of scope**
- **Translating the UI chrome** (buttons, labels, toasts, pages). Defer until there is demand. It needs an i18n framework, which is an architecture change.
- **Translating the user's idea, or the image prompts.** Image prompts and scene descriptions stay English. The idea is sent as typed.
- **Text baked into images in any language.** Prompts keep ending in `textless`. All words are HTML overlays (plan.md §11 decision).
- **Right-to-left languages,** e.g. Arabic and Hebrew. They are not in the set, so no RTL layout work is needed.
- **Auto-detecting the browser language.** The default is English until the user picks one.
- **Real Claude translation.** That arrives with F-009. This spec defines the contract F-009 must honour.
- **Bundling web fonts.** Use system fonts with a fallback stack (see Behaviour rules).

## User flow

1. The user opens `/create`. Directly under **Tone**, and above F-016's **Character look** section, there is a **Caption language** `Select`. It shows the remembered language, or English on first visit, with the hint "Captions and dialogue are written in this language. Pictures never contain text." Each option shows its native name with the English name in brackets, e.g. "हिन्दी (Hindi)".
2. The user picks 日本語. The choice is saved as their default right away and persists after reload.
3. **Enhance on.** **Write script** produces a script whose captions are in Japanese.
   - The title is still derived from the idea in mock mode.
   - Scene descriptions stay English, because they are drawing instructions.
   - With F-017 review, the user can edit the captions in any language.
4. **Enhance off with review on (F-017).** The basic script has empty captions. The user types captions in any language. The language is still stored on the comic.
5. **Enhance off, review off.** There are no captions. The language is stored but has no visible effect.
6. The panels draw. Caption overlays show the Japanese text with correct wrapping. **Download** produces a PNG whose captions wrap inside their boxes with no overflow.
7. `/library/[id]` shows **Language: 日本語 (Japanese)** in Details. Comics made before this feature show **English**.
8. **Remix** opens `/create` with the comic's language selected. It does **not** overwrite the remembered default unless the user changes the picker.

Empty state: no preference is stored, so the picker shows English.
Loading state: the picker is disabled with the rest of the form while scripting, reviewing or drawing.
Error state:
- If reading or writing `panelforge:prefs` throws, the picker still works for the session and the default is simply not remembered. There is no error toast. This covers the prefs key only: the comic data in `panelforge:v1` keeps its existing error handling.
- An unknown stored language ID, from the preference or from a remixed comic, falls back to English.

## Behaviour rules

- **Language list.** It is fixed and lives in `src/lib/presets.ts` as `LANGUAGES`:

  | `id` | Name shown | `lang` attribute | Prompt name (for F-009) |
  |---|---|---|---|
  | `en` | English | `en` | English |
  | `es` | Español (Spanish) | `es` | Spanish |
  | `fr` | Français (French) | `fr` | French |
  | `hi` | हिन्दी (Hindi) | `hi` | Hindi (Devanagari script) |
  | `ja` | 日本語 (Japanese) | `ja` | Japanese |

- **Per-comic setting.** `GenerationSettings.language?: LanguageId`. A missing value means `en`. `getLanguage(id)` falls back to English for unknown IDs.
- **Remembered default.**
  - It lives in localStorage key `panelforge:prefs` as `{ "language": "<id>" }`, in a new module `src/lib/prefs.ts` with `getPrefs()` and `setPrefs(patch)`. Both wrap storage access in try/catch.
  - It is a per-browser UI preference, so it stays out of the `Repository` and out of `panelforge:v1`. Phase 2 (F-010) may move it to the user's profile.
  - It is written only when the user changes the picker. It is read once on `/create` mount when there is no `?from=`.
- **Precedence on `/create`:** a remixed comic's language comes first, then the remembered default, then `en`.
- **What the language affects:**
  - `Script.panels[].caption` only, in both the mock and F-009.
  - It does not change `scene`, `characters`, `title` (mock), image prompts, or anything sent to fal.
- **Mock script.** `MockAIService.writeScript` picks its `LINES[tone]` from a per-language table, `LINES[language][tone]`, with 6 lines × 5 tones per language.
  - The developer translates the existing English lines.
  - Hindi lines use Devanagari and Japanese lines use Japanese script.
  - The lines must be natural, short (≤ 60 characters) and contain no slurs.
- **F-009 contract.** When the real script writer is built, its prompt must say: write captions and dialogue in `<Prompt name>`, and write scene descriptions and the character description in English. Record this in F-009's spec.
- **Image text.**
  - Image prompts are unchanged: English and ending in `textless`.
  - Captions are never sent to the image routes; that is already true in `buildPanelPrompt`.
  - No language words are added to any prompt.
- **Overlay rendering.**
  - `PanelFigure` gets a `lang` prop. Its `<figcaption>` sets `lang={getLanguage(language).lang}`.
  - The panel `alt` text keeps including the caption.
  - The font stack for captions becomes `Geist, system-ui, "Noto Sans", "Nirmala UI", "Noto Sans Devanagari", "Yu Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif`. This covers Windows, macOS and Linux system fonts. No web fonts are bundled.
- **PNG download (`src/lib/download.ts`):**
  - Use the same font stack in `ctx.font`.
  - `wrap()` must break any word wider than `maxWidth` into graphemes. Use `Intl.Segmenter` with granularity `"grapheme"`, with a fallback to `Array.from`. This makes Japanese captions with no spaces wrap inside the box.
  - Text must never overflow the caption box.
  - The filename `slug()` already falls back to `comic` for non-Latin titles. Keep that.
- **Guardrails** (plan.md §8):
  - **Blocklist limitation.** `checkIdea` and `checkText` are English-only regexes, so they do not screen Spanish, French, Hindi or Japanese text. This is a known limitation, accepted because captions never reach the image model and fal's safety checker still screens every image. Claude-side screening in F-009 and F-011 is the real fix.
  - **Unchanged.** Panel caps (`MAX_PANELS = 4`) and cost are unchanged.
- **Dashboard.** No change.
- **Regenerate panel.** No change. The caption comes from the stored script.

## Data and API impact

- **Types (`src/lib/types.ts`):** add `language?: LanguageId` to `GenerationSettings`.
- **Presets (`src/lib/presets.ts`):** add `LANGUAGES`, `LanguageId`, `getLanguage()`, and `CAPTION_FONT_STACK`, which is shared by the overlay and the download.
- **New file `src/lib/prefs.ts`:** `getPrefs(): { language?: LanguageId }` and `setPrefs(patch)`. Storage is wrapped in try/catch and values are validated against `LANGUAGES`.
- **AI service:**
  - The `AIService.writeScript(idea, settings)` signature is unchanged, since the language is in `settings`.
  - `src/lib/ai/mock-ai.ts` gets the per-language `LINES`.
- **Repository / API routes:** no change. The image routes neither receive nor need the language.
- **UI:**
  - `settings-form.tsx`: the picker, plus a call to `setPrefs` on change.
  - `create-view.tsx`: apply the precedence on mount.
  - `components/comic/panel-figure.tsx`: the `lang` prop and the font stack.
  - `create-view.tsx` and `detail-view.tsx` pass `lang` to `PanelFigure`. `detail-view.tsx` also gets the Language row.
  - `src/lib/download.ts`: the font stack and grapheme wrapping. `downloadComicPage` may take an optional `lang`, which is not required.
- **Architecture change needed?**
  - No for this scope.
  - Yes, later, for UI chrome translation (an i18n library and message catalogues). That is why it is out of scope.

## Acceptance criteria

- **AC-1** `/create` shows a **Caption language** picker with exactly the five languages in the table. It shows English on first visit.
- **AC-2** Picking a language writes `panelforge:prefs` = `{"language":"<id>"}`. After a reload, `/create` shows that language.
- **AC-3** With Enhance on and a non-English language, every caption in the written script is in that language: Spanish or French words, Devanagari for `hi`, Japanese characters for `ja`. Scenes stay English.
- **AC-4** The stored generation has `settings.language` set to the chosen ID. No `images[].prompt` or `characters[].prompt` contains caption text or the language name.
- **AC-5** Caption overlays carry the correct `lang` attribute. Hindi and Japanese render as glyphs with no boxes or tofu on Windows Chrome.
- **AC-6** The downloaded PNG of a Japanese comic shows every caption wrapped inside its box, with no text past the box edge.
- **AC-7** `/library/[id]` shows a **Language** row with the native name. Legacy comics show "English".
- **AC-8** Remix selects the comic's language. `panelforge:prefs` is unchanged unless the user then changes the picker.
- **AC-9** An unknown language ID, in prefs or in a remixed comic's settings, falls back to English without errors.
- **AC-10** If reading or writing `panelforge:prefs` throws, `/create` still loads, the picker works for the session, nothing is remembered, and no error toast appears.
- **AC-11** The picker is disabled while scripting, reviewing and drawing.

## Test plan

Run browser checks in **mock mode** (`NEXT_PUBLIC_AI_MODE=mock`, restart the dev server) unless marked `[paid]`. Read data from localStorage keys `panelforge:v1` and `panelforge:prefs`.

### Browser checks
| # | Route | Steps | Expected |
|---|---|---|---|
| B-1 | `/create` | In the console, run `localStorage.removeItem("panelforge:prefs")` and reload. Open the Caption language picker. | It shows English. The options are English, Español (Spanish), Français (French), हिन्दी (Hindi) and 日本語 (Japanese). (AC-1) |
| B-2 | `/create` | Pick Español. Reload. | The picker shows Español, and `panelforge:prefs` is `{"language":"es"}`. (AC-2) |
| B-3 | `/create` | Japanese, Funny tone, 4 panels, Enhance on. Write script. | All 4 captions are Japanese text and the scenes are English. (AC-3) |
| B-4 | `/create` | Repeat B-3 with Hindi, then with French. | The Hindi captions are in Devanagari and the French captions are French. (AC-3) |
| B-5 | (B-3 run) | Approve and draw. Read `panelforge:v1`. | `settings.language === "ja"`. No `images[].prompt` or `characters[].prompt` contains Japanese characters or the word "Japanese". (AC-4) |
| B-6 | (B-3 result) | Inspect a caption overlay in DevTools. Zoom into the panels. | `<figcaption lang="ja">`. The glyphs render correctly, with no tofu boxes. Repeat with a Hindi comic and expect `lang="hi"`. (AC-5) |
| B-7 | (B-3 result) | Click Download. Open the PNG. | Every Japanese caption wraps within its box, with no overflow past the box edge. The filename is `comic.png` or the slug. (AC-6) |
| B-8 | `/library/[id]` | Open the B-3 comic, then a comic made before this build. | Language: 日本語 (Japanese), and Language: English respectively. (AC-7) |
| B-9 | `/library/[id]` → Remix | Set the prefs to `es` first. Remix the Japanese comic. | The picker shows 日本語 and `panelforge:prefs` still reads `es`. Open `/create` fresh with no `?from=`: it shows Español. (AC-8) |
| B-10 | `/create` | In the console, set `panelforge:prefs` to `{"language":"tlh"}` and reload. Separately, edit a stored generation's `settings.language` to `"xx"` and Remix it. | Both cases show English with no console errors. (AC-9) |
| B-11 | `/create` | In the console, make prefs writes throw: `const o=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(k==="panelforge:prefs") throw new Error("blocked"); return o.call(this,k,v) }`. Pick French and generate. Reload. | No toast and no console crash. The comic draws with French captions. After the reload the picker shows the previous remembered language, or English. (AC-10) |
| B-12 | `/create` | Generate and watch the picker. | It is disabled during scripting, review and drawing. (AC-11) |
| B-13 `[paid]` | `/create` (fal mode) | Quality **Draft**, **3** panels, Japanese, Enhance on, idea "A cat runs a ramen stall". Approve. Log about $0.033 in `docs/ai-spend.md`. | The captions are Japanese HTML overlays. The art itself contains no Japanese or English lettering, beyond the stray marks Draft sometimes adds; note those if any. Take a screenshot. |

### API checks
The image routes do not take a language. These confirm that an extra field is ignored and that validation is unchanged. None reach fal.

| # | Request | Body | Expected status / shape |
|---|---|---|---|
| A-1 | `POST /api/character` | `{"prompt":"","aspectRatio":"1:1","language":"ja"}` | `400 {"error":"prompt must be 1–2000 characters"}`. The language field does not change validation. |
| A-2 | `POST /api/panels` | `{"prompt":"a hero","aspectRatio":"9:16","language":"klingon","panelIndex":0,"referenceUrl":"https://v3.fal.media/files/x.jpg"}` | `400 {"error":"Unknown aspectRatio"}`. There is no language error, because the field is ignored. |
| A-3 | `POST /api/character` | The body `{"prompt":` (truncated JSON) | `400 {"error":"Invalid JSON body"}` |
| A-4 | `POST /api/panels` | `{"prompt":"x".repeat(2001),"aspectRatio":"1:1","panelIndex":0,"referenceUrl":"https://v3.fal.media/files/x.jpg","language":"hi"}` | `400 {"error":"prompt must be 1–2000 characters"}` |

### Regression checks
- Create → save → appears in Library → dashboard counts update → delete → counts drop.
- An English comic made with the default language is identical to before: the same English captions for the same tone and panel count.
- The PNG download of an English comic wraps exactly as before (the word-wrap still breaks on spaces).
- Regenerating a single panel on a Japanese comic keeps its Japanese caption.
- F-017 review: editing a Japanese caption and approving shows the edited text.
- The idea guardrail (`checkIdea`) still blocks English blocked words in the idea.

Checks that spend fal.ai credits are marked `[paid]`. Total for this spec is about $0.033 (B-13).

## Open questions

These were decided by PM without asking the owner. The owner can override them.
- **Five languages.** More can be added by appending to `LANGUAGES` and the mock `LINES`.
- **UI chrome translation is out** until an i18n decision is made, which needs an architecture change.
- **Scenes and image prompts stay English,** and no text is baked into images in any language.
- **Default language.** It is English, with no auto-detect from the browser.
- **Non-English moderation.** Non-English captions are not screened by the English blocklist. This is accepted until F-009 and F-011 add Claude-side screening.

## Implementation notes

_Filled in by the developer agent: files changed, architecture changes and why, how to test._

Built on branch worktree-agent-a3d834f6ebb061b7e (0239a2c), merged 2026-11-21. Files: presets.ts (LANGUAGES, getLanguage, CAPTION_FONT_STACK), types.ts (language?), new prefs.ts (localStorage panelforge:prefs), mock-ai.ts (translated captions), download.ts (grapheme wrapping + Japanese line-break rule), panel-figure.tsx (lang attr), settings-form.tsx (Caption language picker), create-view.tsx (precedence: Remix comic > remembered > English), detail-view.tsx (Language row). Architecture change: none; language never reaches the server. Paid B-13 blocked (fal 401).
