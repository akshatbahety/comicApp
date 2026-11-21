import type { Character, DashboardStats, Generation, PanelImage } from "@/lib/types";

export type NewGeneration = Omit<Generation, "id" | "createdAt">;
export type NewImage = Omit<PanelImage, "id" | "createdAt" | "supersededBy">;
export type NewCharacter = Omit<Character, "id" | "createdAt">;

export interface GenerationWithImages {
  generation: Generation;
  /** Current images only (superseded ones excluded), ordered by panel. */
  images: PanelImage[];
  /** The reference character the panels were drawn from, if any. */
  character: Character | null;
}

export interface ImageWithGeneration extends PanelImage {
  generation: Generation;
}

/**
 * Everything the UI needs from storage. Phase 1 uses a browser (localStorage)
 * implementation; Phase 2 adds a Supabase one behind the same interface.
 */
export interface Repository {
  listGenerations(opts?: { savedOnly?: boolean }): Promise<GenerationWithImages[]>;
  getGeneration(id: string): Promise<GenerationWithImages | null>;
  listImages(opts?: { savedOnly?: boolean }): Promise<ImageWithGeneration[]>;
  getStats(): Promise<DashboardStats>;

  createGeneration(input: NewGeneration): Promise<Generation>;
  updateGeneration(id: string, patch: Partial<NewGeneration>): Promise<Generation>;
  deleteGeneration(id: string): Promise<void>;

  addImage(input: NewImage): Promise<PanelImage>;
  /** Stores a regenerated image and marks the old one as superseded. */
  replaceImage(oldImageId: string, input: NewImage): Promise<PanelImage>;

  createCharacter(input: NewCharacter): Promise<Character>;
  getCharacter(id: string): Promise<Character | null>;
  listCharacters(): Promise<Character[]>;

  /** Called whenever data changes, so views can refresh. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
}
