/**
 * Generation option presets. Each style carries the prompt suffix sent to the
 * image model and a swatch palette used by the UI (and the Phase 1 mock art).
 */

export const STYLES = [
  {
    id: "comic",
    name: "Comic",
    hint: "Bold ink, flat colour",
    prompt: "classic American comic book art, bold black ink outlines, flat vibrant colours, dynamic composition",
    palette: ["#25283D", "#8F3985", "#EFD9CE", "#F2C14E"],
  },
  {
    id: "manga",
    name: "Manga",
    hint: "Screentone, B&W",
    prompt: "black and white manga illustration, screentone shading, expressive linework, dramatic speed lines",
    palette: ["#1F2030", "#5D6075", "#B9B3BF", "#F4F1EE"],
  },
  {
    id: "webtoon",
    name: "Webtoon",
    hint: "Soft full colour",
    prompt: "webtoon style digital illustration, soft cel shading, clean lines, pastel full colour",
    palette: ["#CEA2AC", "#A675A1", "#EFD9CE", "#7FB7BE"],
  },
  {
    id: "noir",
    name: "Noir",
    hint: "Hard shadows",
    prompt: "film noir comic art, high contrast chiaroscuro, heavy black shadows, rain, moody lighting",
    palette: ["#111218", "#25283D", "#5D6075", "#E8E2D9"],
  },
  {
    id: "popart",
    name: "Pop-art",
    hint: "Retro halftone",
    prompt: "retro pop-art comic, Ben-Day halftone dots, bold primary colours, 1960s print aesthetic",
    palette: ["#8F3985", "#F2C14E", "#2E86AB", "#EFD9CE"],
  },
  {
    id: "cartoon",
    name: "Cartoon",
    hint: "Rounded, playful",
    prompt: "friendly cartoon illustration, rounded shapes, thick outlines, bright cheerful colours",
    palette: ["#A675A1", "#F6AE2D", "#86BBD8", "#FCFAF9"],
  },
  {
    id: "watercolour",
    name: "Watercolour",
    hint: "Painterly washes",
    prompt: "storybook watercolour illustration, soft painterly washes, textured paper, gentle light",
    palette: ["#EFD9CE", "#CEA2AC", "#9DB5B2", "#5D6075"],
  },
  {
    id: "sketch",
    name: "Sketch",
    hint: "Pencil storyboard",
    prompt: "rough pencil storyboard sketch, loose graphite lines, minimal shading, film storyboard frame",
    palette: ["#5D6075", "#B9B3BF", "#E2D6D1", "#FCFAF9"],
  },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

/**
 * Testing phase: real fal.ai images cost money, so comics are capped at 3–4 panels.
 * Restore [1, 3, 4, 6] (and MAX_PANELS = 6) once models and costs are settled.
 */
export const PANEL_COUNTS = [3, 4] as const;

/** Server-side cap on panels per generation, enforced by /api/panels. */
export const MAX_PANELS = 4;

export const ASPECT_RATIOS = [
  { id: "1:1", name: "1:1 Square", width: 1024, height: 1024 },
  { id: "3:4", name: "3:4 Portrait", width: 768, height: 1024 },
  { id: "16:9", name: "16:9 Landscape", width: 1024, height: 576 },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export const COLOR_MODES = [
  { id: "full", name: "Full colour", prompt: "full colour" },
  { id: "mono", name: "Monochrome", prompt: "black and white, monochrome" },
  { id: "limited", name: "Limited palette", prompt: "limited three-colour palette" },
] as const;

export type ColorModeId = (typeof COLOR_MODES)[number]["id"];

export const TONES = [
  { id: "funny", name: "Funny" },
  { id: "dramatic", name: "Dramatic" },
  { id: "action", name: "Action" },
  { id: "wholesome", name: "Wholesome" },
  { id: "spooky", name: "Spooky" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

/**
 * Image quality tiers. Each comic first draws one character reference with the
 * tier's text-to-image model, then draws every panel with its image-edit model,
 * passing the character in as a reference image. The server maps tier → models
 * (see lib/ai/fal.ts). Costs are approximate fal list prices at ~1MP, Nov 2026;
 * FLUX.2 edit bills the reference image as input megapixels too.
 */
export const QUALITIES = [
  {
    id: "low",
    name: "Draft",
    hint: "Fastest, for testing",
    characterModel: "fal-ai/flux/schnell",
    panelModel: "fal-ai/flux-2/flash/edit",
    modelName: "FLUX.2 Flash",
    characterCost: 0.003,
    panelCost: 0.01,
  },
  {
    id: "medium",
    name: "Standard",
    hint: "Better detail & prompt following",
    characterModel: "fal-ai/flux-2",
    panelModel: "fal-ai/flux-2/edit",
    modelName: "FLUX.2 dev",
    characterCost: 0.012,
    panelCost: 0.024,
  },
  {
    id: "high",
    name: "Best",
    hint: "Most faithful characters, ~1 min per comic",
    characterModel: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    panelModel: "fal-ai/bytedance/seedream/v4.5/edit",
    modelName: "Seedream 4.5",
    characterCost: 0.04,
    panelCost: 0.04,
  },
] as const;

export type QualityId = (typeof QUALITIES)[number]["id"];

/** Falls back to Draft for comics saved before quality tiers existed. */
export const getQuality = (id: QualityId | undefined) => QUALITIES.find((q) => q.id === id) ?? QUALITIES[0];

/** One character reference + N panels. */
export const estimateCost = (quality: QualityId | undefined, panels: number) => {
  const q = getQuality(quality);
  return q.characterCost + panels * q.panelCost;
};

export const formatCost = (usd: number) => (usd < 0.01 ? `<$0.01` : `$${usd.toFixed(2)}`);

export const getStyle = (id: StyleId) => STYLES.find((s) => s.id === id) ?? STYLES[0];
export const getAspect = (id: AspectRatioId) => ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
export const getColorMode = (id: ColorModeId) => COLOR_MODES.find((c) => c.id === id) ?? COLOR_MODES[0];
export const getTone = (id: ToneId) => TONES.find((t) => t.id === id) ?? TONES[0];

/** Columns used to lay out N panels as a comic page. */
export const panelColumns = (count: number) => (count === 1 ? 1 : count === 4 ? 2 : 3);

export const MAX_IDEA_LENGTH = 500;
