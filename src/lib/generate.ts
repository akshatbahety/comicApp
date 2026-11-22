import { ai, buildPanelPrompt, titleFromIdea } from "@/lib/ai";
import { hashString } from "@/lib/ai/mock-art";
import { buildCharacterPrompt, characterDescription } from "@/lib/ai/prompts";
import { getQuality, normalizeFace } from "@/lib/presets";
import { repo } from "@/lib/data";
import type { Character, Generation, GenerationSettings, PanelImage, Script } from "@/lib/types";

export type PanelEvent =
  | { index: number; status: "done"; image: PanelImage }
  | { index: number; status: "error"; error: string };

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

/** Draws the reference character for a comic and stores it as its own record. */
async function createCharacter(idea: string, script: Script | null, settings: GenerationSettings, seed: number) {
  const prompt = buildCharacterPrompt(idea, script, settings);
  const out = await ai.generateCharacter({ prompt, settings, seed });
  const face = normalizeFace(settings.face);
  return repo.createCharacter({
    description: characterDescription(idea, script),
    prompt,
    imageUrl: out.url,
    width: out.width,
    height: out.height,
    style: settings.style,
    quality: getQuality(settings.quality).id,
    model: out.model,
    ...(face ? { face } : {}),
  });
}

async function drawPanel(generation: Generation, character: Character, panelIndex: number, seed: number) {
  const prompt = buildPanelPrompt(generation.idea, generation.script, panelIndex, generation.settings, {
    withReference: true,
  });
  const out = await ai.generatePanel({
    prompt,
    settings: generation.settings,
    panelIndex,
    seed,
    referenceUrl: character.imageUrl,
  });
  return {
    generationId: generation.id,
    panelIndex,
    prompt,
    caption: generation.script?.panels[panelIndex]?.caption ?? "",
    url: out.url,
    width: out.width,
    height: out.height,
  };
}

/**
 * Records a generation, draws its reference character first, then draws every
 * panel in parallel from that character. Each finished panel is stored
 * immediately and reported through `onPanel`. If the character fails, no panels
 * are drawn (they'd have nothing to stay consistent with).
 */
export async function runGeneration(opts: {
  idea: string;
  settings: GenerationSettings;
  script: Script | null;
  onCreated?: (generationId: string) => void;
  onCharacter?: (character: Character) => void;
  onPanel?: (e: PanelEvent) => void;
}) {
  const { idea, settings, script } = opts;
  let generation = await repo.createGeneration({
    title: script?.title || titleFromIdea(idea),
    idea: idea.trim(),
    script,
    settings,
    model: ai.modelFor(settings),
    status: "pending",
    saved: false,
  });
  opts.onCreated?.(generation.id);

  const baseSeed = hashString(generation.id);

  let character: Character;
  try {
    character = await createCharacter(idea, script, settings, baseSeed);
    generation = await repo.updateGeneration(generation.id, { characterId: character.id });
    opts.onCharacter?.(character);
  } catch (err) {
    await repo.updateGeneration(generation.id, { status: "failed", error: `Character: ${message(err)}` });
    throw new Error(`Couldn't draw the character: ${message(err)}`);
  }

  const results = await Promise.allSettled(
    Array.from({ length: settings.panelCount }, async (_, index) => {
      try {
        const image = await repo.addImage(await drawPanel(generation, character, index, baseSeed + (index + 1) * 7919));
        opts.onPanel?.({ index, status: "done", image });
      } catch (err) {
        opts.onPanel?.({ index, status: "error", error: message(err) });
        throw err;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  await repo.updateGeneration(generation.id, {
    status: failed === results.length ? "failed" : "done",
    error: failed ? `${failed} of ${results.length} panels failed` : undefined,
  });
  return generation.id;
}

/**
 * Redraws one panel with a new seed from the comic's stored character, and
 * replaces its image. Comics made before characters existed get one drawn first.
 */
export async function regeneratePanel(opts: {
  generationId: string;
  panelIndex: number;
  previousImageId?: string;
}) {
  const found = await repo.getGeneration(opts.generationId);
  if (!found) throw new Error("Generation not found");
  let { generation } = found;
  let character = found.character;
  if (!character) {
    character = await createCharacter(generation.idea, generation.script, generation.settings, Date.now() % 2 ** 31);
    generation = await repo.updateGeneration(generation.id, { characterId: character.id });
  }

  const input = await drawPanel(generation, character, opts.panelIndex, Math.floor(Math.random() * 2 ** 31));
  const image = opts.previousImageId
    ? await repo.replaceImage(opts.previousImageId, input)
    : await repo.addImage(input);
  if (generation.status !== "done") await repo.updateGeneration(generation.id, { status: "done", error: undefined });
  return image;
}
