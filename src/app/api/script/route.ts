import Anthropic from "@anthropic-ai/sdk";
import { ClaudeNotConfiguredError, ScriptRefusedError, writeScript } from "@/lib/ai/claude";
import { checkIdea } from "@/lib/ai/prompts";
import { badRequest, readJson, requireUser } from "@/lib/ai/request";
import { getLanguage, PANEL_COUNTS, TONES } from "@/lib/presets";
import type { GenerationSettings } from "@/lib/types";

/** Claude usually answers in 5–20s. */
export const maxDuration = 60;

/** POST /api/script — Claude turns an idea into a panel script (F-009). */
export async function POST(request: Request) {
  const denied = await requireUser("scripts");
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return badRequest("Invalid JSON body");

  const idea = typeof body.idea === "string" ? body.idea : "";
  if (idea.length > 1000) return badRequest("Keep your idea to 1000 characters or fewer.");
  const ideaError = checkIdea(idea);
  if (ideaError) return badRequest(ideaError);

  const panelCount = Number(body.panelCount);
  if (!(PANEL_COUNTS as readonly number[]).includes(panelCount)) return badRequest("Unknown panelCount");
  const tone = TONES.find((t) => t.id === body.tone);
  if (!tone) return badRequest("Unknown tone");
  const language = getLanguage(typeof body.language === "string" ? body.language : undefined);

  try {
    const script = await writeScript(idea, {
      panelCount,
      tone: tone.id,
      language: language.id,
    } as GenerationSettings);
    return Response.json(script);
  } catch (err) {
    if (err instanceof ClaudeNotConfiguredError) return badRequest(err.message, 503);
    if (err instanceof ScriptRefusedError) return badRequest(err.message, 422);
    console.error("[claude] script failed", err);
    // A rejected key is our configuration problem, not the user's idea.
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      return badRequest("Script writing is temporarily unavailable. Please try again later.", 503);
    if (err instanceof Anthropic.RateLimitError)
      return badRequest("Claude is busy right now. Try again in a minute.", 503);
    if (err instanceof Anthropic.APIError) return badRequest("Claude couldn't write the script. Try again.", 502);
    return badRequest(err instanceof Error ? err.message : "Script writing failed", 502);
  }
}
