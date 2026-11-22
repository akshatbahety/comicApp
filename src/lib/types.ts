import type { AspectRatioId, ColorModeId, QualityId, StyleId, ToneId } from "./presets";
import type { EyewearId, FacialHairId, HairColourId, HairStyleId, LanguageId, SkinToneId } from "./presets";

export type PanelCount = 1 | 3 | 4 | 6;

/** Main character's look (F-016). Each key is optional; a missing key means "Any". */
export type FacialFeatures = Partial<{
  hairStyle: HairStyleId;
  hairColour: HairColourId;
  skinTone: SkinToneId;
  facialHair: FacialHairId;
  eyewear: EyewearId;
}>;

export interface GenerationSettings {
  style: StyleId;
  panelCount: PanelCount;
  aspectRatio: AspectRatioId;
  colorMode: ColorModeId;
  tone: ToneId;
  /** Caption/dialogue language. Missing on comics made before F-018 (treated as "en"). */
  language?: LanguageId;
  /** Image model tier. Missing on comics made before tiers existed (treated as "low"). */
  quality?: QualityId;
  /** Whether Claude expanded the idea into a script before drawing. */
  enhance: boolean;
  /** Character look choices. Absent when every picker is "Any". */
  face?: FacialFeatures;
  /** Whether the script was reviewed before drawing. Missing on older comics (treated as equal to `enhance`). */
  reviewScript?: boolean;
}

/** One panel of a script: what to draw, and the text shown over it. */
export interface ScriptPanel {
  scene: string;
  caption: string;
}

export interface Script {
  title: string;
  /** Shared description injected into every panel prompt for consistency. */
  characters: string;
  panels: ScriptPanel[];
}

/**
 * A character reference image. Drawn once per comic, then passed to every panel
 * as a reference so the character looks the same throughout. Stored as its own
 * record so characters can be saved and reused in future comics.
 */
export interface Character {
  id: string;
  createdAt: string; // ISO
  /** Who the character is, in words (also repeated in every panel prompt). */
  description: string;
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
  style: StyleId;
  quality: QualityId;
  model: string;
  /** Look choices the reference was drawn with. Absent when none were set. */
  face?: FacialFeatures;
}

export type GenerationStatus = "pending" | "done" | "failed";

/** One click of "Generate". Produces `settings.panelCount` images. */
export interface Generation {
  id: string;
  createdAt: string; // ISO
  title: string;
  idea: string;
  script: Script | null;
  settings: GenerationSettings;
  /** Panel model label (e.g. the fal edit endpoint). */
  model: string;
  /** Reference character every panel was drawn from. Absent on older comics. */
  characterId?: string;
  status: GenerationStatus;
  error?: string;
  saved: boolean;
}

/** One image produced for a generation's panel. */
export interface PanelImage {
  id: string;
  generationId: string;
  createdAt: string; // ISO
  panelIndex: number;
  prompt: string;
  caption: string;
  url: string;
  width: number;
  height: number;
  /** Set when this image was replaced by a regenerated one. Kept so stats stay honest. */
  supersededBy?: string;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  generations: number;
  images: number;
}

export interface DashboardStats {
  totalGenerations: number;
  totalImages: number;
  savedImages: number;
  generationsThisWeek: number;
  imagesThisWeek: number;
  topStyle: { style: StyleId; count: number } | null;
  imagesByStyle: { style: StyleId; count: number }[];
  activity: DailyActivity[]; // last 14 days, oldest first
}
