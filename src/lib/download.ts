import { CAPTION_FONT_STACK, getLanguage, panelColumns, type LanguageId } from "@/lib/presets";
import type { PanelImage } from "@/lib/types";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load an image for download"));
    img.src = src;
  });
}

/** User-perceived characters, so Devanagari conjuncts and emoji never split mid-glyph. */
function graphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const NO_LINE_START = /^[、。，．,.!?！？…‥ー）」』】〕〉》ゃゅょっャュョッぁぃぅぇぉァィゥェォ।]$/u;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth;
  // Breaks on spaces, but not on no-break spaces (French "voilà !").
  const words = text.split(/[^\S  ]+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (fits(next)) {
      line = next;
    } else if (fits(w)) {
      lines.push(line);
      line = w;
    } else {
      // A word wider than the box (e.g. Japanese, which has no spaces): break it
      // into graphemes. The last chunk stays open so following words can join it.
      let chunk = line ? [line, " "] : [];
      let prefix = chunk.length; // the open line + space: never carried down
      for (const g of graphemes(w)) {
        if (chunk.length && !fits(chunk.join("") + g)) {
          // Closing punctuation never starts a line (Japanese kinsoku): carry the previous character down with it.
          const carry = NO_LINE_START.test(g) && chunk.length > Math.max(prefix, 1) ? chunk.splice(-1) : [];
          lines.push(chunk.join("").trimEnd());
          chunk = [...carry, g];
          prefix = 0;
        } else chunk.push(g);
      }
      line = chunk.join("");
    }
  }
  if (line) lines.push(line);
  return lines;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "comic";
}

/** Renders panels (with caption overlays) onto one page and downloads it as PNG. */
export async function downloadComicPage(
  title: string,
  images: PanelImage[],
  opts?: { captions?: boolean; lang?: LanguageId }
) {
  if (!images.length) return;
  const showCaptions = opts?.captions ?? true;
  const cols = panelColumns(images.length);
  const rows = Math.ceil(images.length / cols);
  const cellW = 800;
  const cellH = Math.round((cellW * images[0].height) / images[0].width);
  const gap = 24;
  const pad = 40;

  const canvas = document.createElement("canvas");
  // Canvas text inherits the element's language, which picks the right CJK glyph variants.
  canvas.lang = getLanguage(opts?.lang).lang;
  canvas.width = pad * 2 + cols * cellW + (cols - 1) * gap;
  canvas.height = pad * 2 + rows * cellH + (rows - 1) * gap;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const loaded = await Promise.all(images.map((i) => loadImage(i.url)));
  loaded.forEach((img, i) => {
    const x = pad + (i % cols) * (cellW + gap);
    const y = pad + Math.floor(i / cols) * (cellH + gap);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 16);
    ctx.clip();
    ctx.drawImage(img, x, y, cellW, cellH);
    ctx.restore();

    const caption = images[i].caption;
    if (showCaptions && caption) {
      ctx.font = `500 26px ${CAPTION_FONT_STACK}`;
      const lines = wrap(ctx, caption, cellW - 72);
      const boxH = lines.length * 34 + 28;
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.beginPath();
      ctx.roundRect(x + 18, y + cellH - boxH - 18, cellW - 36, boxH, 12);
      ctx.fill();
      ctx.fillStyle = "#25283d";
      lines.forEach((l, li) => ctx.fillText(l, x + 36, y + cellH - boxH - 18 + 40 + li * 34));
    }
  });

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't create the image file");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(title)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
