import { computeStats } from "@/lib/stats";
import type { Character, Generation, PanelImage } from "@/lib/types";
import type {
  GenerationWithImages,
  ImageWithGeneration,
  NewCharacter,
  NewGeneration,
  NewImage,
  Repository,
} from "./repository";

const STORAGE_KEY = "panelforge:v1";

interface Store {
  generations: Generation[];
  images: PanelImage[];
  characters: Character[];
}

const emptyStore = (): Store => ({ generations: [], images: [], characters: [] });

/**
 * Phase 1 repository: keeps everything in localStorage so the full flow works
 * without a backend. Replaced by a Supabase implementation in Phase 2.
 */
export class LocalRepository implements Repository {
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      // Keep multiple tabs in sync.
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) this.emit();
      });
    }
  }

  private read(): Store {
    if (typeof window === "undefined") return emptyStore();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw) as Partial<Store>;
      return {
        generations: parsed.generations ?? [],
        images: parsed.images ?? [],
        characters: parsed.characters ?? [],
      };
    } catch {
      return emptyStore();
    }
  }

  private write(store: Store) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      throw new Error(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "Browser storage is full. Delete some generations and try again."
          : "Couldn't save to browser storage."
      );
    }
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private withImages(store: Store, generation: Generation): GenerationWithImages {
    const images = store.images
      .filter((i) => i.generationId === generation.id && !i.supersededBy)
      .sort((a, b) => a.panelIndex - b.panelIndex);
    const character = store.characters.find((c) => c.id === generation.characterId) ?? null;
    return { generation, images, character };
  }

  async listGenerations(opts?: { savedOnly?: boolean }) {
    const store = this.read();
    return store.generations
      .filter((g) => !opts?.savedOnly || g.saved)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((g) => this.withImages(store, g));
  }

  async getGeneration(id: string) {
    const store = this.read();
    const g = store.generations.find((x) => x.id === id);
    return g ? this.withImages(store, g) : null;
  }

  async listImages(opts?: { savedOnly?: boolean }) {
    const store = this.read();
    const genById = new Map(store.generations.map((g) => [g.id, g]));
    const out: ImageWithGeneration[] = [];
    for (const img of store.images) {
      if (img.supersededBy) continue;
      const generation = genById.get(img.generationId);
      if (!generation || (opts?.savedOnly && !generation.saved)) continue;
      out.push({ ...img, generation });
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getStats() {
    const store = this.read();
    return computeStats(store.generations, store.images);
  }

  async createGeneration(input: NewGeneration) {
    const store = this.read();
    const generation: Generation = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    store.generations.push(generation);
    this.write(store);
    return generation;
  }

  async updateGeneration(id: string, patch: Partial<NewGeneration>) {
    const store = this.read();
    const idx = store.generations.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error("Generation not found");
    store.generations[idx] = { ...store.generations[idx], ...patch };
    this.write(store);
    return store.generations[idx];
  }

  async deleteGeneration(id: string) {
    const store = this.read();
    store.generations = store.generations.filter((g) => g.id !== id);
    store.images = store.images.filter((i) => i.generationId !== id);
    this.write(store);
  }

  async addImage(input: NewImage) {
    const store = this.read();
    const image: PanelImage = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    store.images.push(image);
    this.write(store);
    return image;
  }

  async replaceImage(oldImageId: string, input: NewImage) {
    const store = this.read();
    const image: PanelImage = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const old = store.images.find((i) => i.id === oldImageId);
    if (old) old.supersededBy = image.id;
    store.images.push(image);
    this.write(store);
    return image;
  }

  async createCharacter(input: NewCharacter) {
    const store = this.read();
    const character: Character = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    store.characters.push(character);
    this.write(store);
    return character;
  }

  async getCharacter(id: string) {
    return this.read().characters.find((c) => c.id === id) ?? null;
  }

  async listCharacters() {
    return this.read().characters.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
