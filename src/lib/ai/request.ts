import "server-only";
import { ASPECT_RATIOS, QUALITIES } from "@/lib/presets";
import { createServerSupabase, getUserId } from "@/lib/supabase/server";
import { FalNotConfiguredError } from "./fal";
import { checkText } from "./prompts";

/** Shared request parsing for the image API routes. */

export const badRequest = (error: string, status = 400) => Response.json({ error }, { status });

/** Image routes spend fal credits, so only signed-in users may call them. */
export async function requireUser() {
  const userId = await getUserId();
  return userId ? null : badRequest("Sign in to generate images.", 401);
}

/**
 * Reserves one image against the daily limits (per user and site-wide, kept in
 * Supabase `quota_settings`). Returns an error Response, or a `release` function
 * to call if drawing fails so the failure doesn't count.
 */
export async function reserveImage(kind: "character" | "panel"): Promise<Response | { release: () => Promise<void> }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("reserve_image", { p_kind: kind });
  if (error) {
    if (error.message.includes("quota_user"))
      return badRequest("You've reached today's image limit. It resets at midnight UTC.", 429);
    if (error.message.includes("quota_global"))
      return badRequest("Panelforge has reached its image limit for today. Please try again tomorrow.", 503);
    if (error.message.includes("not_signed_in")) return badRequest("Sign in to generate images.", 401);
    console.error("[quota] reserve failed", error);
    return badRequest("Couldn't check your image limit. Try again.", 500);
  }
  const id = data as string;
  return {
    release: async () => {
      const { error: releaseError } = await supabase.rpc("release_image", { p_id: id });
      if (releaseError) console.error("[quota] release failed", releaseError);
    },
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/** Validates the fields every image request has. Returns an error string or the parsed values. */
export function parseImageRequest(body: Record<string, unknown>) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 2000) return "prompt must be 1–2000 characters";
  if (checkText(prompt)) return "That prompt isn't something we can generate.";

  const aspect = ASPECT_RATIOS.find((a) => a.id === body.aspectRatio);
  if (!aspect) return "Unknown aspectRatio";

  const quality = body.quality === undefined ? QUALITIES[0] : QUALITIES.find((q) => q.id === body.quality);
  if (!quality) return "Unknown quality";

  const seed = Number.isInteger(body.seed)
    ? Math.abs(body.seed as number) % 2 ** 31
    : Math.floor(Math.random() * 2 ** 31);

  return { prompt, width: aspect.width, height: aspect.height, quality: quality.id, seed };
}

export function falErrorResponse(err: unknown, what: string) {
  if (err instanceof FalNotConfiguredError) return badRequest(err.message, 503);
  console.error(`[fal] ${what} failed`, err);
  return badRequest(err instanceof Error ? err.message : `${what} failed`, 502);
}
