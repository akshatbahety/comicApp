import type { ToneId } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";
import { drawMockPanel } from "./mock-art";
import { titleFromIdea } from "./prompts";
import type { AIService, ImageRequest, PanelRequest } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Placeholder beats until Claude writes real scripts. Purely visual: the subject
 * is added once by buildPanelPrompt, and story words ("payoff", the idea's own
 * phrasing repeated) get painted into images as text.
 */
const BEATS: Record<number, string[]> = {
  1: ["Dynamic medium shot of the main character in action"],
  3: [
    "Wide establishing shot of the main character in their surroundings",
    "Medium action shot of the main character hard at work",
    "Close-up of the main character grinning in triumph",
  ],
  4: [
    "Wide establishing shot of the main character in their surroundings",
    "Close-up of the main character looking surprised",
    "Medium action shot of the main character searching and chasing",
    "Wide shot of the main character celebrating with raised arms",
  ],
  6: [
    "Wide establishing shot of the main character in their surroundings",
    "Close-up of the main character looking surprised",
    "Over-the-shoulder shot of the main character discovering a clue",
    "Medium action shot of the main character chasing",
    "Dramatic low-angle shot of the main character at the big moment",
    "Calm wide shot of the main character relaxing afterwards",
  ],
};

const LINES: Record<ToneId, string[]> = {
  funny: ["Well, this is awkward.", "Nobody panic. I'm panicking.", "That was NOT in the plan.", "Totally meant to do that.", "Ta-da!", "Same time tomorrow?"],
  dramatic: ["It all started here.", "Something isn't right.", "There's no turning back now.", "Everything rests on this.", "Now.", "And so it ended — for now."],
  action: ["Let's move!", "Incoming!", "Hold on tight!", "Not today!", "BOOM.", "Mission complete."],
  wholesome: ["What a lovely day.", "Oh! Are you okay?", "We can fix this together.", "Look what we made!", "Thank you, friend.", "Best day ever."],
  spooky: ["Did you hear that?", "The lights flickered.", "Don't look behind you.", "It's getting closer…", "RUN.", "…or was it just the wind?"],
};

/** Phase 1 stand-in for Claude + fal.ai: canned scripts and drawn placeholder scenes. */
export class MockAIService implements AIService {
  modelFor() {
    return "demo-mock";
  }

  async writeScript(idea: string, settings: GenerationSettings): Promise<Script> {
    await sleep(900 + Math.random() * 600);
    const beats = BEATS[settings.panelCount] ?? BEATS[4];
    const lines = LINES[settings.tone];
    return {
      title: titleFromIdea(idea),
      characters: `the main character of: ${idea.trim()}`,
      panels: beats.map((beat, i) => ({
        scene: beat.replace("{idea}", idea.trim().replace(/\.$/, "")),
        caption: settings.panelCount === 1 ? lines[0] : lines[Math.round((i * (lines.length - 1)) / (beats.length - 1))],
      })),
    };
  }

  async generateCharacter(req: ImageRequest) {
    await sleep(900 + Math.random() * 600);
    return { ...drawMockPanel({ ...req.settings, aspectRatio: "1:1" }, 0, req.seed), model: "demo-mock" };
  }

  async generatePanel(req: PanelRequest) {
    await sleep(1200 + Math.random() * 1600);
    return { ...drawMockPanel(req.settings, req.panelIndex, req.seed), model: "demo-mock" };
  }
}
