import { faceOptions, getColorMode, getStyle, getTone, SCRIPT_LIMITS } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";

/**
 * Camera shots used to vary panels when there's no script. Purely visual on
 * purpose: story words like "payoff" or "ending" get painted into the image as text.
 */
const SHOTS: Record<number, string[]> = {
  1: ["Dynamic medium shot"],
  3: ["Wide establishing shot", "Medium action shot", "Close-up reaction shot"],
  4: ["Wide establishing shot", "Close-up on the face", "Medium action shot", "Final wide shot"],
  6: [
    "Wide establishing shot",
    "Close-up on the face",
    "Over-the-shoulder shot",
    "Medium action shot",
    "Dramatic low-angle shot",
    "Final wide shot",
  ],
};

export const shotFor = (panelCount: number, panelIndex: number) =>
  (SHOTS[panelCount] ?? SHOTS[4])[panelIndex] ?? "Medium shot";

const clean = (s: string) => s.trim().replace(/[."“”]+$/g, "").replace(/["“”]/g, "");

/**
 * Builds the image prompt for one panel. Shared by the mock and the real provider.
 *
 * Tested on FLUX schnell: the scene goes first, the subject is stated once, and the
 * style comes last ending in "textless". Captions/dialogue are never sent (they're
 * overlaid in HTML). Avoid "comic panel", "no speech bubbles" (FLUX has no negative
 * prompt, so naming bubbles adds them) and repeating title-like phrases, all of which
 * make the model paint lettering into the picture.
 */
export function buildPanelPrompt(
  idea: string,
  script: Script | null,
  panelIndex: number,
  settings: GenerationSettings,
  opts?: { withReference?: boolean }
) {
  const style = getStyle(settings.style);
  const colour = getColorMode(settings.colorMode);
  const tone = getTone(settings.tone);
  const scene = clean(script?.panels[panelIndex]?.scene || shotFor(settings.panelCount, panelIndex));
  const cast = characterDescription(idea, script);
  const look = `${style.prompt}, illustration style, ${colour.prompt}, ${tone.name.toLowerCase()} mood, textless.`;
  if (opts?.withReference) {
    // The reference image carries the character's look, so the user's raw idea is
    // left out: tested on FLUX.2 edit, any sentence like "solves the mystery of the
    // missing fish" gets lettered into speech bubbles. Story must come from the
    // scene description (Claude's script). Edit models also change as little as
    // possible by default, so ask explicitly for a new pose and full background.
    return (
      `Create a new illustration featuring the exact character from the reference image: ` +
      `keep the same face, body, outfit and colours. ${scene}. ` +
      `New pose and expression, full detailed background environment, not a white background. ${look}`
    );
  }
  return `${scene}. Subject: ${cast}, same character design in every panel. ${look}`;
}

/** Who the main character is, in words. Claude's script provides this; otherwise the idea. */
export function characterDescription(idea: string, script: Script | null) {
  return clean(script?.characters || `the main character of: ${idea}`);
}

/**
 * "Face and look: curly hair, red hair, round glasses." from the look pickers, in
 * table order, or "" when nothing is set. Input is normalised first, so a tampered
 * stored record can only ever contribute known preset fragments.
 */
export function featuresClause(face: unknown) {
  const fragments = faceOptions(face).map((o) => o.prompt);
  return fragments.length ? `Face and look: ${fragments.join(", ")}.` : "";
}

/**
 * Prompt for the character reference drawn before any panel. One full-body figure
 * on plain white: multi-view turnaround sheets get copied into panels as layouts.
 */
export function buildCharacterPrompt(idea: string, script: Script | null, settings: GenerationSettings) {
  const style = getStyle(settings.style);
  const colour = getColorMode(settings.colorMode);
  const look = featuresClause(settings.face);
  return (
    `Character design: a single full-body view of ${characterDescription(idea, script)}. ` +
    (look ? `${look} ` : "") +
    `Standing in a neutral three-quarter pose, centered, whole body visible from head to toe, ` +
    `plain white background, no scenery, clear distinctive outfit and colours. ` +
    `${style.prompt}, illustration style, ${colour.prompt}, textless.`
  );
}

/**
 * Minimal guardrail so obviously unsafe text never reaches a model. Checked on the
 * idea in the browser and on every image prompt on the server (parseImageRequest).
 * Phase 3 adds Claude-side screening and the image model's safety checker.
 */
const BLOCKED = [/\bnud(e|ity)\b/i, /\bnaked\b/i, /\bporn/i, /\bsexual\b/i, /\bgore\b/i, /\bbehead/i, /\bchild\s+abuse/i];

/** Shared blocklist check with no length rule (F-016, reused by F-017). Error message or null. */
export function checkText(text: string): string | null {
  return BLOCKED.some((re) => re.test(text)) ? "That text isn't something we can generate." : null;
}

export function checkIdea(idea: string): string | null {
  const trimmed = idea.trim();
  if (trimmed.length < 3) return "Describe your idea in a few words first.";
  if (checkText(trimmed)) return "That idea isn't something we can generate. Try a different prompt.";
  return null;
}

/** "a cat detective solves a mystery" → "Cat Detective Solves A Mystery" (max 5 words). */
export function titleFromIdea(idea: string) {
  const words = idea
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && /^(a|an|the)$/i.test(words[0])) words.shift();
  const title = words
    .slice(0, 5)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return title || "Untitled";
}

// ---------------------------------------------------------------------------
// F-017 script review
// ---------------------------------------------------------------------------

/**
 * The script used for review when Enhance is off. No AI call. Drawn unedited, it
 * produces exactly the same prompts as drawing with no script at all.
 */
export function basicScript(idea: string, settings: GenerationSettings): Script {
  return {
    title: titleFromIdea(idea),
    characters: `the main character of: ${idea.trim()}`,
    panels: Array.from({ length: settings.panelCount }, (_, i) => ({ scene: shotFor(settings.panelCount, i), caption: "" })),
  };
}

/** Trims every field and applies the empty-title fallback. This is what gets drawn and stored. */
export function finalizeScript(script: Script, idea: string): Script {
  return {
    title: script.title.trim() || titleFromIdea(idea),
    characters: script.characters.trim(),
    panels: script.panels.map((p) => ({ scene: p.scene.trim(), caption: p.caption.trim() })),
  };
}

const BLOCKED_FIELD = "That text isn't something we can generate.";

/**
 * Checks a reviewed script before drawing. Returns field path → message
 * (`title`, `characters`, `panels.N.scene`, `panels.N.caption`), empty when valid.
 */
export function validateScript(script: Script, idea: string): Record<string, string> {
  const s = finalizeScript(script, idea);
  const errors: Record<string, string> = {};
  const check = (path: string, value: string, max: number, required?: string) => {
    if (!value) {
      if (required) errors[path] = required;
    } else if (value.length > max) errors[path] = `Keep this to ${max} characters or fewer.`;
    else if (checkText(value)) errors[path] = BLOCKED_FIELD;
  };
  check("title", s.title, SCRIPT_LIMITS.title);
  check("characters", s.characters, SCRIPT_LIMITS.characters);
  s.panels.forEach((p, i) => {
    check(`panels.${i}.scene`, p.scene, SCRIPT_LIMITS.scene, `Describe what happens in panel ${i + 1}.`);
    check(`panels.${i}.caption`, p.caption, SCRIPT_LIMITS.caption);
  });
  return errors;
}
