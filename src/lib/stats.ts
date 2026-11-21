import type { StyleId } from "@/lib/presets";
import type { DailyActivity, DashboardStats, Generation, PanelImage } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Derives dashboard numbers from raw records.
 * "Images created" counts every image ever generated, including ones later
 * replaced by a panel regeneration.
 */
export function computeStats(
  generations: Generation[],
  images: PanelImage[],
  now = new Date()
): DashboardStats {
  const genById = new Map(generations.map((g) => [g.id, g]));
  const weekAgo = now.getTime() - 7 * DAY_MS;

  const activityMap = new Map<string, DailyActivity>();
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    activityMap.set(key, { date: key, generations: 0, images: 0 });
  }

  const styleCounts = new Map<StyleId, number>();
  const genStyleCounts = new Map<StyleId, number>();
  let generationsThisWeek = 0;
  let imagesThisWeek = 0;
  let savedImages = 0;

  for (const g of generations) {
    const t = new Date(g.createdAt);
    if (t.getTime() >= weekAgo) generationsThisWeek++;
    const day = activityMap.get(dayKey(t));
    if (day) day.generations++;
    genStyleCounts.set(g.settings.style, (genStyleCounts.get(g.settings.style) ?? 0) + 1);
  }

  for (const img of images) {
    const gen = genById.get(img.generationId);
    const t = new Date(img.createdAt);
    if (t.getTime() >= weekAgo) imagesThisWeek++;
    const day = activityMap.get(dayKey(t));
    if (day) day.images++;
    if (gen) {
      styleCounts.set(gen.settings.style, (styleCounts.get(gen.settings.style) ?? 0) + 1);
      if (gen.saved && !img.supersededBy) savedImages++;
    }
  }

  const imagesByStyle = [...styleCounts.entries()]
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count);

  const topGen = [...genStyleCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalGenerations: generations.length,
    totalImages: images.length,
    savedImages,
    generationsThisWeek,
    imagesThisWeek,
    topStyle: topGen ? { style: topGen[0], count: topGen[1] } : null,
    imagesByStyle,
    activity: [...activityMap.values()],
  };
}
