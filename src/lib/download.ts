import { panelColumns } from "@/lib/presets";
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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "comic";
}

/** Renders panels (with caption overlays) onto one page and downloads it as PNG. */
export async function downloadComicPage(title: string, images: PanelImage[], opts?: { captions?: boolean }) {
  if (!images.length) return;
  const showCaptions = opts?.captions ?? true;
  const cols = panelColumns(images.length);
  const rows = Math.ceil(images.length / cols);
  const cellW = 800;
  const cellH = Math.round((cellW * images[0].height) / images[0].width);
  const gap = 24;
  const pad = 40;

  const canvas = document.createElement("canvas");
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
      ctx.font = "500 26px Geist, system-ui, sans-serif";
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
