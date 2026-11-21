import type { GenerationSettings, Script } from "@/lib/types";

export interface ImageRequest {
  prompt: string;
  settings: GenerationSettings;
  /** Changes on regenerate so the result differs. */
  seed: number;
}

export interface PanelRequest extends ImageRequest {
  panelIndex: number;
  /** URL of the character reference image every panel is drawn from. */
  referenceUrl: string;
}

export interface ImageResult {
  url: string;
  width: number;
  height: number;
  /** Model that drew it. */
  model: string;
}

/** @deprecated alias kept for callers that only deal with panels. */
export type PanelResult = ImageResult;

/**
 * AI provider boundary. The mock draws placeholders offline; the fal provider calls
 * our API routes (keys never reach the browser). Scripts come from Claude later.
 */
export interface AIService {
  /** Panel model label stored on each generation (depends on the chosen quality tier). */
  modelFor(settings: GenerationSettings): string;
  writeScript(idea: string, settings: GenerationSettings): Promise<Script>;
  /** Draws the reference character a comic's panels are based on. */
  generateCharacter(req: ImageRequest): Promise<ImageResult>;
  generatePanel(req: PanelRequest): Promise<ImageResult>;
}
