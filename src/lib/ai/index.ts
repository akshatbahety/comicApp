import { FalAIService } from "./fal-ai";
import { MockAIService } from "./mock-ai";
import type { AIService } from "./types";

export type * from "./types";
export { buildPanelPrompt, checkIdea, titleFromIdea } from "./prompts";

/**
 * The app-wide AI provider. Real images come from fal.ai by default;
 * set NEXT_PUBLIC_AI_MODE=mock in .env.local to use offline placeholder art.
 */
export const ai: AIService = process.env.NEXT_PUBLIC_AI_MODE === "mock" ? new MockAIService() : new FalAIService();
