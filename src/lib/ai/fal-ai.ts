import { getQuality } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";
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
 * Browser-side provider that calls our /api routes: scripts from Claude
 * (ANTHROPIC_API_KEY), images from fal (FAL_KEY). Keys stay on the server.
 */
export class FalAIService implements AIService {
  modelFor(settings: GenerationSettings) {
    return getQuality(settings.quality).panelModel;
  }

  async writeScript(idea: string, settings: GenerationSettings): Promise<Script> {
    const res = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        panelCount: settings.panelCount,
        tone: settings.tone,
        language: settings.language,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Script request failed (${res.status})`);
    return { title: data.title, characters: data.characters, panels: data.panels };
  }

  generateCharacter(req: ImageRequest) {
    // The reference is always square: a full-body figure, whatever the panel shape.
    return post("/api/character", { ...common(req), aspectRatio: "1:1" });
  }

  generatePanel(req: PanelRequest) {
    return post("/api/panels", { ...common(req), panelIndex: req.panelIndex, referenceUrl: req.referenceUrl });
  }
}
