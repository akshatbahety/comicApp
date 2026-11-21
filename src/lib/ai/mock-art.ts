import { getAspect, getStyle } from "@/lib/presets";
import type { GenerationSettings } from "@/lib/types";

/** Small deterministic PRNG so the same seed draws the same picture. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toGray(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const h = y.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

/**
 * Draws a simple placeholder "scene" as an SVG data URL. Used only by the
 * Phase 1 mock so layouts, saving and stats can be built before real models.
 */
export function drawMockPanel(settings: GenerationSettings, panelIndex: number, seed: number) {
  const { width, height } = getAspect(settings.aspectRatio);
  const style = getStyle(settings.style);
  const rand = mulberry32(seed);

  let palette: string[] = [...style.palette];
  if (settings.colorMode === "mono") palette = palette.map(toGray);
  if (settings.colorMode === "limited") palette = [palette[0], palette[1], palette[2], palette[2]];
  const [ink, mid, light, pop] = palette;

  const horizon = height * (0.55 + rand() * 0.15);
  const parts: string[] = [];

  parts.push(`<rect width="${width}" height="${height}" fill="${light}"/>`);
  // Sun / moon
  const r = Math.min(width, height) * (0.08 + rand() * 0.08);
  parts.push(`<circle cx="${(0.15 + rand() * 0.7) * width}" cy="${horizon * (0.25 + rand() * 0.35)}" r="${r}" fill="${pop}"/>`);
  // Rolling ground
  const y1 = horizon + (rand() - 0.5) * height * 0.1;
  const y2 = horizon + (rand() - 0.5) * height * 0.1;
  parts.push(
    `<path d="M0 ${horizon} C ${width * 0.3} ${y1}, ${width * 0.6} ${y2}, ${width} ${horizon} L ${width} ${height} L 0 ${height} Z" fill="${mid}"/>`
  );
  // Silhouettes (buildings or trees)
  const count = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const w = width * (0.06 + rand() * 0.1);
    const h = height * (0.12 + rand() * 0.3);
    const x = rand() * (width - w);
    parts.push(`<rect x="${x}" y="${horizon - h}" width="${w}" height="${h + 4}" rx="${w * 0.12}" fill="${ink}" opacity="${0.75 + rand() * 0.25}"/>`);
  }
  // A "character": head + body
  const cx = width * (0.3 + rand() * 0.4);
  const scale = Math.min(width, height) * (0.12 + rand() * 0.06);
  parts.push(`<rect x="${cx - scale * 0.45}" y="${horizon - scale * 0.2}" width="${scale * 0.9}" height="${scale * 1.4}" rx="${scale * 0.4}" fill="${ink}"/>`);
  parts.push(`<circle cx="${cx}" cy="${horizon - scale * 0.55}" r="${scale * 0.38}" fill="${ink}"/>`);

  // Style texture
  let defs = "";
  if (settings.style === "popart" || settings.style === "manga") {
    defs = `<defs><pattern id="d" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.4" fill="${ink}" opacity="0.18"/></pattern></defs>`;
    parts.push(`<rect width="${width}" height="${height}" fill="url(#d)"/>`);
  }
  if (settings.style === "sketch") {
    for (let i = 0; i < 18; i++) {
      const y = rand() * height;
      parts.push(`<line x1="${rand() * width * 0.3}" y1="${y}" x2="${width * (0.7 + rand() * 0.3)}" y2="${y + (rand() - 0.5) * 30}" stroke="${ink}" stroke-width="1.5" opacity="0.15"/>`);
    }
  }
  if (settings.style === "noir") {
    for (let i = 0; i < 40; i++) {
      const x = rand() * width, y = rand() * height;
      parts.push(`<line x1="${x}" y1="${y}" x2="${x - 12}" y2="${y + 40}" stroke="${light}" stroke-width="2" opacity="0.35"/>`);
    }
  }

  parts.push(
    `<text x="${width - 24}" y="${height - 24}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${Math.round(width / 40)}" fill="${ink}" opacity="0.55">DEMO · ${panelIndex + 1}</text>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}${parts.join("")}</svg>`;
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width, height };
}
