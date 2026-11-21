import "server-only";
import { ASPECT_RATIOS, QUALITIES } from "@/lib/presets";
import { FalNotConfiguredError } from "./fal";

/** Shared request parsing for the image API routes. */

export const badRequest = (error: string, status = 400) => Response.json({ error }, { status });

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
