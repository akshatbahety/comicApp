import "server-only";
import { createFalClient } from "@fal-ai/client";
import { getQuality, type QualityId } from "@/lib/presets";

/**
 * Server-only fal.ai client. FAL_KEY is read from the environment (.env.local)
 * and never reaches the browser — the browser calls our /api routes.
 *
 * Pipeline: one character reference is drawn with the tier's text-to-image model,
 * then every panel is drawn with the tier's edit model using that image as input.
 */

export class FalNotConfiguredError extends Error {
  constructor() {
    super("FAL_KEY is not set. Add it to .env.local and restart the dev server.");
  }
}

let client: ReturnType<typeof createFalClient> | null = null;

function getClient() {
  const key = process.env.FAL_KEY;
  if (!key) throw new FalNotConfiguredError();
  client ??= createFalClient({ credentials: key });
  return client;
}

interface ImageInput {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}

/** Scales a size up so its shorter side is at least `min` (keeps the aspect ratio). */
function atLeast(width: number, height: number, min: number) {
  const k = Math.max(1, min / Math.min(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

const FLUX_COMMON = { enable_safety_checker: true, output_format: "jpeg", num_images: 1 } as const;

/** Text-to-image input per tier, for the character reference. */
const CHARACTER_INPUTS: Record<QualityId, (p: ImageInput) => Record<string, unknown>> = {
  low: (p) => ({
    ...FLUX_COMMON,
    prompt: p.prompt,
    image_size: { width: p.width, height: p.height },
    seed: p.seed,
    num_inference_steps: 4,
  }),
  medium: (p) => ({ ...FLUX_COMMON, prompt: p.prompt, image_size: { width: p.width, height: p.height }, seed: p.seed }),
  // Seedream needs ≥1920px on the short side (flat price per image).
  high: (p) => ({
    prompt: p.prompt,
    image_size: atLeast(p.width, p.height, 1920),
    seed: p.seed,
    num_images: 1,
    max_images: 1,
    enable_safety_checker: true,
  }),
};

/** Edit-model input per tier, for panels drawn from the character reference. */
const PANEL_INPUTS: Record<QualityId, (p: ImageInput & { referenceUrl: string }) => Record<string, unknown>> = {
  low: (p) => ({
    ...FLUX_COMMON,
    prompt: p.prompt,
    image_urls: [p.referenceUrl],
    image_size: { width: p.width, height: p.height },
    seed: p.seed,
  }),
  medium: (p) => ({
    ...FLUX_COMMON,
    prompt: p.prompt,
    image_urls: [p.referenceUrl],
    image_size: { width: p.width, height: p.height },
    seed: p.seed,
  }),
  high: (p) => ({
    prompt: p.prompt,
    image_urls: [p.referenceUrl],
    image_size: atLeast(p.width, p.height, 1920),
    seed: p.seed,
    num_images: 1,
    max_images: 1,
    enable_safety_checker: true,
  }),
};

interface FalImageOutput {
  images: { url: string; width?: number; height?: number }[];
  has_nsfw_concepts?: boolean[];
}

async function run(endpoint: string, input: Record<string, unknown>) {
  const result = await getClient().subscribe(endpoint, { input });
  const data = result.data as FalImageOutput;
  const image = data.images?.[0];
  if (!image?.url) throw new Error("fal returned no image");
  if (data.has_nsfw_concepts?.[0]) throw new Error("This image was blocked by the safety checker. Try again.");
  return { url: image.url, requestId: result.requestId };
}

export async function generateCharacter(opts: ImageInput & { quality: QualityId }) {
  const tier = getQuality(opts.quality);
  const out = await run(tier.characterModel, CHARACTER_INPUTS[tier.id](opts));
  return { ...out, width: opts.width, height: opts.height, model: tier.characterModel };
}

export async function generatePanel(opts: ImageInput & { quality: QualityId; referenceUrl: string }) {
  const tier = getQuality(opts.quality);
  const out = await run(tier.panelModel, PANEL_INPUTS[tier.id](opts));
  // Report the panel's layout size so the comic grid stays consistent across tiers.
  return { ...out, width: opts.width, height: opts.height, model: tier.panelModel };
}

/**
 * Reference images may only come from fal's CDN or from a signed URL into this
 * app's own Supabase Storage bucket (where characters are kept after F-010).
 */
export function isAllowedReferenceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media")) return true;
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
    return (
      !!supabase &&
      url.hostname === supabase.hostname &&
      url.pathname.startsWith("/storage/v1/object/sign/comics/") &&
      url.searchParams.has("token")
    );
  } catch {
    return false;
  }
}
