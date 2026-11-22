import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getLanguage, getTone, SCRIPT_LIMITS } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";
import { checkText, titleFromIdea } from "./prompts";

/**
 * Server-only Claude script writer (F-009). ANTHROPIC_API_KEY is read from the
 * environment (.env.local) and never reaches the browser — the browser calls
 * POST /api/script.
 */

export const SCRIPT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }
}

/** Claude declined to write this idea (safety classifiers), even after the fallback model. */
export class ScriptRefusedError extends Error {
  constructor() {
    super("Claude couldn't write a script for that idea. Try a different prompt.");
  }
}

let client: Anthropic | null = null;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeNotConfiguredError();
  client ??= new Anthropic({ apiKey });
  return client;
}

/** Length limits are enforced after parsing; structured outputs only guarantee the shape. */
const ScriptSchema = z.object({
  title: z.string(),
  characters: z.string(),
  panels: z.array(z.object({ scene: z.string(), caption: z.string() })),
});

/**
 * Stable across requests (so it can be cached later). The rules mirror what the
 * image pipeline in prompts.ts learned: scenes are drawn by an edit model from a
 * character reference image, and any story words or quoted text in a scene get
 * painted into the picture as lettering.
 */
const SYSTEM = `You write short comic scripts for Panelforge, an app that turns a one-line idea into a comic strip.

An image model draws each panel from your "scene" text plus a reference image of the main character. Captions are shown over the finished image in HTML, so they are never drawn.

Write:
- "title": a catchy comic title, at most ${SCRIPT_LIMITS.title} characters.
- "characters": a concrete visual description of the main character, at most ${SCRIPT_LIMITS.characters} characters: species or type, age, build, face, hair, outfit and colours. This is used to draw the reference image, so describe looks only, not personality or backstory.
- "panels": exactly the requested number of panels, in story order, together telling one complete mini-story with a setup, a turn and a payoff that fits the idea and the tone.
  - "scene" (English, at most ${SCRIPT_LIMITS.scene} characters): what the image shows. Start with the camera shot (e.g. "Wide shot", "Close-up", "Low-angle shot"), then the main character's action, pose and expression, then the setting, lighting and any other characters or props. Refer to the main character as "the character"; don't re-describe their looks. Each panel needs a different shot and a clearly different moment.
  - "caption" (at most ${SCRIPT_LIMITS.caption} characters): a line of narration or dialogue in the requested caption language. Short and punchy; it should add to the image, not describe it.

Scene rules — the image model paints any text it sees:
- Purely visual description. Never put quoted words, dialogue, sound effects, signs, labels, book titles, logos or any written text in a scene.
- Never mention comics, panels, speech bubbles, captions, lettering or text.
- Never use story-structure words like "payoff", "climax", "ending" or "punchline".
- Keep everything suitable for a general audience: no nudity, sexual content or gore.`;

function userPrompt(idea: string, settings: GenerationSettings) {
  const language = getLanguage(settings.language);
  return [
    `Idea: ${idea.trim()}`,
    `Tone: ${getTone(settings.tone).name}`,
    `Number of panels: ${settings.panelCount}`,
    `Caption language: ${language.promptName}. Write every caption in ${language.promptName}; write title, characters and scenes in English.`,
  ].join("\n");
}

const clip = (s: string, max: number) => {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
};

/** Asks Claude for a panel script. Throws ClaudeNotConfiguredError, ScriptRefusedError or an SDK error. */
export async function writeScript(idea: string, settings: GenerationSettings): Promise<Script & { model: string }> {
  const response = await getClient().beta.messages.parse({
    model: SCRIPT_MODEL,
    max_tokens: 16000,
    // On a safety decline, the API re-runs the request on a fallback model it picks.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // A short creative task: low effort keeps the wait (and cost) down.
    output_config: { effort: "low", format: betaZodOutputFormat(ScriptSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(idea, settings) }],
  });

  if (response.stop_reason === "refusal") throw new ScriptRefusedError();
  if (response.stop_reason === "max_tokens") throw new Error("Claude's script was cut off. Try again.");
  const out = response.parsed_output;
  if (!out) throw new Error("Claude returned a script we couldn't read. Try again.");

  const panels = out.panels.slice(0, settings.panelCount);
  if (panels.length < settings.panelCount) throw new Error("Claude wrote too few panels. Try again.");

  const script: Script = {
    title: clip(out.title, SCRIPT_LIMITS.title) || titleFromIdea(idea),
    characters: clip(out.characters, SCRIPT_LIMITS.characters),
    panels: panels.map((p) => ({
      scene: clip(p.scene, SCRIPT_LIMITS.scene),
      caption: clip(p.caption, SCRIPT_LIMITS.caption),
    })),
  };
  const all = [script.title, script.characters, ...script.panels.flatMap((p) => [p.scene, p.caption])];
  if (all.some((t) => checkText(t))) throw new ScriptRefusedError();
  return { ...script, model: response.model };
}
