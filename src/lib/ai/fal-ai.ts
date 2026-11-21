import { getQuality } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";
import { MockAIService } from "./mock-ai";
import type { AIService, ImageRequest, ImageResult, PanelRequest } from "./types";

async function post(path: string, body: Record<string, unknown>): Promise<ImageResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Image request failed (${res.status})`);
  return { url: data.url, width: data.width, height: data.height, model: data.model };
}

const common = (req: ImageRequest) => ({
  quality: getQuality(req.settings.quality).id,
  prompt: req.prompt,
  aspectRatio: req.settings.aspectRatio,
  seed: req.seed,
});

/**
 * Browser-side provider that draws through our /api routes (which hold FAL_KEY).
 * Scripts still come from the mock until Claude is wired in.
 */
export class FalAIService implements AIService {
  private scripts = new MockAIService();

  modelFor(settings: GenerationSettings) {
    return getQuality(settings.quality).panelModel;
  }

  writeScript(idea: string, settings: GenerationSettings): Promise<Script> {
    return this.scripts.writeScript(idea, settings);
  }

  generateCharacter(req: ImageRequest) {
    // The reference is always square: a full-body figure, whatever the panel shape.
    return post("/api/character", { ...common(req), aspectRatio: "1:1" });
  }

  generatePanel(req: PanelRequest) {
    return post("/api/panels", { ...common(req), panelIndex: req.panelIndex, referenceUrl: req.referenceUrl });
  }
}
