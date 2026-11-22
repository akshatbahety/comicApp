import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStats } from "@/lib/stats";
import { COMICS_BUCKET, getSupabase } from "@/lib/supabase/client";
import type { Character, FacialFeatures, Generation, GenerationSettings, PanelImage, Script } from "@/lib/types";
import type { QualityId, StyleId } from "@/lib/presets";
import type {
  GenerationWithImages,
  ImageWithGeneration,
  NewCharacter,
  NewGeneration,
  NewImage,
  Repository,
} from "./repository";

/* ---------- Row shapes (match supabase/migrations) ---------- */

interface CharacterRow {
  id: string;
  created_at: string;
  description: string;
  prompt: string;
  storage_path: string;
  source_url: string | null;
  width: number;
  height: number;
  style: string;
  quality: string;
  model: string;
  face: FacialFeatures | null;
}

interface GenerationRow {
  id: string;
  created_at: string;
  title: string;
  idea: string;
  script: Script | null;
  settings: GenerationSettings;
  model: string;
  character_id: string | null;
  status: Generation["status"];
  error: string | null;
  saved: boolean;
}

interface ImageRow {
  id: string;
  generation_id: string;
  created_at: string;
  panel_index: number;
  prompt: string;
  caption: string;
  storage_path: string;
  source_url: string | null;
  width: number;
  height: number;
  superseded_by: string | null;
}

const toGeneration = (r: GenerationRow): Generation => ({
  id: r.id,
  createdAt: r.created_at,
  title: r.title,
  idea: r.idea,
  script: r.script,
  settings: r.settings,
  model: r.model,
  ...(r.character_id ? { characterId: r.character_id } : {}),
  status: r.status,
  ...(r.error ? { error: r.error } : {}),
  saved: r.saved,
});

function generationPatch(patch: Partial<NewGeneration>) {
  const out: Record<string, unknown> = {};
  if ("title" in patch) out.title = patch.title;
  if ("idea" in patch) out.idea = patch.idea;
  if ("script" in patch) out.script = patch.script;
  if ("settings" in patch) out.settings = patch.settings;
  if ("model" in patch) out.model = patch.model;
  if ("characterId" in patch) out.character_id = patch.characterId ?? null;
  if ("status" in patch) out.status = patch.status;
  if ("error" in patch) out.error = patch.error ?? null;
  if ("saved" in patch) out.saved = patch.saved;
  return out;
}

const SIGNED_URL_TTL = 60 * 60; // seconds
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const IMAGE_COLUMNS =
  "id, generation_id, created_at, panel_index, prompt, caption, storage_path, source_url, width, height, superseded_by";
const CHARACTER_COLUMNS =
  "id, created_at, description, prompt, storage_path, source_url, width, height, style, quality, model, face";
const GENERATION_COLUMNS =
  "id, created_at, title, idea, script, settings, model, character_id, status, error, saved";

/**
 * Phase 2 repository (F-010): rows in Postgres, images in the private `comics`
 * Storage bucket under `{user_id}/...`. Every image handed to the repository
 * (a fal.media URL or a mock data: URL) is copied into Storage, so comics
 * survive after fal's links expire. Reads return short-lived signed URLs.
 * Row-level security limits every query to the signed-in user.
 */
export class SupabaseRepository implements Repository {
  private listeners = new Set<() => void>();
  /** storage_path → signed URL and when it stops being safe to hand out. */
  private signed = new Map<string, { url: string; until: number }>();

  constructor() {
    // The module is also evaluated during server rendering; auth only exists in the browser.
    if (typeof window === "undefined") return;
    // SIGNED_IN also fires when a tab regains focus; only react when the user actually changes.
    let current: string | null | undefined;
    this.db.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (current !== undefined && id !== current) {
        this.signed.clear();
        this.emit();
      }
      current = id;
    });
  }

  private get db(): SupabaseClient {
    return getSupabase();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private async userId() {
    const { data } = await this.db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("You're signed out. Sign in again to continue.");
    return id;
  }

  /* ---------- Storage ---------- */

  /** Copies an image (https or data: URL) into the user's folder. Returns its storage path. */
  async storeImage(url: string, folder: string, id: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't fetch the image to save it (${res.status})`);
    const blob = await res.blob();
    const type = blob.type.split(";")[0] || "image/jpeg";
    const path = `${await this.userId()}/${folder}/${id}.${EXT[type] ?? "jpg"}`;
    const { error } = await this.db.storage
      .from(COMICS_BUCKET)
      .upload(path, blob, { contentType: type, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Couldn't save the image: ${error.message}`);
    return path;
  }

  /** Signs every path in one request, reusing URLs that are still fresh. */
  private async signAll(paths: string[]) {
    const now = Date.now();
    const missing = [...new Set(paths)].filter((p) => p && (this.signed.get(p)?.until ?? 0) <= now);
    if (missing.length) {
      const { data, error } = await this.db.storage.from(COMICS_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);
      if (error) throw new Error(`Couldn't load images: ${error.message}`);
      // Hand a URL out for at most 50 minutes of its 60, so a page left open keeps working.
      const until = now + (SIGNED_URL_TTL - 600) * 1000;
      for (const item of data ?? []) if (item.path && item.signedUrl) this.signed.set(item.path, { url: item.signedUrl, until });
    }
    return (path: string) => this.signed.get(path)?.url ?? "";
  }

  private toImage(r: ImageRow, sign: (p: string) => string): PanelImage {
    return {
      id: r.id,
      generationId: r.generation_id,
      createdAt: r.created_at,
      panelIndex: r.panel_index,
      prompt: r.prompt,
      caption: r.caption,
      url: sign(r.storage_path),
      width: r.width,
      height: r.height,
      ...(r.superseded_by ? { supersededBy: r.superseded_by } : {}),
    };
  }

  private toCharacter(r: CharacterRow, sign: (p: string) => string): Character {
    return {
      id: r.id,
      createdAt: r.created_at,
      description: r.description,
      prompt: r.prompt,
      imageUrl: sign(r.storage_path),
      width: r.width,
      height: r.height,
      style: r.style as StyleId,
      quality: r.quality as QualityId,
      model: r.model,
      ...(r.face ? { face: r.face } : {}),
    };
  }

  /* ---------- Reads ---------- */

  private async assemble(rows: GenerationRow[]): Promise<GenerationWithImages[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const charIds = [...new Set(rows.map((r) => r.character_id).filter((x): x is string => !!x))];
    const [imgs, chars] = await Promise.all([
      this.db.from("panel_images").select(IMAGE_COLUMNS).in("generation_id", ids).is("superseded_by", null),
      charIds.length
        ? this.db.from("characters").select(CHARACTER_COLUMNS).in("id", charIds)
        : Promise.resolve({ data: [] as CharacterRow[], error: null }),
    ]);
    if (imgs.error) throw new Error(imgs.error.message);
    if (chars.error) throw new Error(chars.error.message);
    const imageRows = (imgs.data ?? []) as ImageRow[];
    const charRows = (chars.data ?? []) as CharacterRow[];
    const sign = await this.signAll([...imageRows.map((i) => i.storage_path), ...charRows.map((c) => c.storage_path)]);

    const charById = new Map(charRows.map((c) => [c.id, this.toCharacter(c, sign)]));
    const imagesByGen = new Map<string, PanelImage[]>();
    for (const r of imageRows) {
      const list = imagesByGen.get(r.generation_id) ?? [];
      list.push(this.toImage(r, sign));
      imagesByGen.set(r.generation_id, list);
    }
    return rows.map((r) => ({
      generation: toGeneration(r),
      images: (imagesByGen.get(r.id) ?? []).sort((a, b) => a.panelIndex - b.panelIndex),
      character: (r.character_id && charById.get(r.character_id)) || null,
    }));
  }

  async listGenerations(opts?: { savedOnly?: boolean }) {
    let q = this.db.from("generations").select(GENERATION_COLUMNS).order("created_at", { ascending: false });
    if (opts?.savedOnly) q = q.eq("saved", true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return this.assemble((data ?? []) as GenerationRow[]);
  }

  async getGeneration(id: string) {
    const { data, error } = await this.db.from("generations").select(GENERATION_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return (await this.assemble([data as GenerationRow]))[0];
  }

  async listImages(opts?: { savedOnly?: boolean }) {
    const all = await this.listGenerations(opts);
    const out: ImageWithGeneration[] = all.flatMap(({ generation, images }) =>
      images.map((img) => ({ ...img, generation }))
    );
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getStats() {
    const [gens, imgs] = await Promise.all([
      this.db.from("generations").select(GENERATION_COLUMNS),
      // Superseded images included: "images created" counts every one ever drawn.
      this.db.from("panel_images").select(IMAGE_COLUMNS),
    ]);
    if (gens.error) throw new Error(gens.error.message);
    if (imgs.error) throw new Error(imgs.error.message);
    const none = () => "";
    return computeStats(
      ((gens.data ?? []) as GenerationRow[]).map(toGeneration),
      ((imgs.data ?? []) as ImageRow[]).map((r) => this.toImage(r, none))
    );
  }

  /* ---------- Writes ---------- */

  async createGeneration(input: NewGeneration & { id?: string; createdAt?: string }) {
    const { data, error } = await this.db
      .from("generations")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        ...(input.createdAt ? { created_at: input.createdAt } : {}),
        ...generationPatch(input),
      })
      .select(GENERATION_COLUMNS)
      .single();
    if (error) throw new Error(`Couldn't save the comic: ${error.message}`);
    this.emit();
    return toGeneration(data as GenerationRow);
  }

  async updateGeneration(id: string, patch: Partial<NewGeneration>) {
    const { data, error } = await this.db
      .from("generations")
      .update(generationPatch(patch))
      .eq("id", id)
      .select(GENERATION_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Couldn't update the comic: ${error.message}`);
    if (!data) throw new Error("Generation not found");
    this.emit();
    return toGeneration(data as GenerationRow);
  }

  async deleteGeneration(id: string) {
    const { data: imgs } = await this.db.from("panel_images").select("storage_path").eq("generation_id", id);
    const { error } = await this.db.from("generations").delete().eq("id", id);
    if (error) throw new Error(`Couldn't delete the comic: ${error.message}`);
    const paths = (imgs ?? []).map((i: { storage_path: string }) => i.storage_path);
    // Rows are gone either way; a leftover file is only wasted space.
    if (paths.length) await this.db.storage.from(COMICS_BUCKET).remove(paths);
    this.emit();
  }

  private async insertImage(input: NewImage & { id?: string; createdAt?: string }) {
    const id = input.id ?? crypto.randomUUID();
    const storagePath = await this.storeImage(input.url, input.generationId, id);
    const { data, error } = await this.db
      .from("panel_images")
      .insert({
        id,
        ...(input.createdAt ? { created_at: input.createdAt } : {}),
        generation_id: input.generationId,
        panel_index: input.panelIndex,
        prompt: input.prompt,
        caption: input.caption,
        storage_path: storagePath,
        source_url: input.url.startsWith("data:") ? null : input.url,
        width: input.width,
        height: input.height,
      })
      .select(IMAGE_COLUMNS)
      .single();
    if (error) throw new Error(`Couldn't save the panel: ${error.message}`);
    const sign = await this.signAll([storagePath]);
    return this.toImage(data as ImageRow, sign);
  }

  async addImage(input: NewImage & { id?: string; createdAt?: string }) {
    const image = await this.insertImage(input);
    this.emit();
    return image;
  }

  async replaceImage(oldImageId: string, input: NewImage) {
    const image = await this.insertImage(input);
    const { error } = await this.db.from("panel_images").update({ superseded_by: image.id }).eq("id", oldImageId);
    if (error) throw new Error(`Couldn't replace the panel: ${error.message}`);
    this.emit();
    return image;
  }

  async createCharacter(input: NewCharacter & { id?: string; createdAt?: string }) {
    const id = input.id ?? crypto.randomUUID();
    const storagePath = await this.storeImage(input.imageUrl, "characters", id);
    const { data, error } = await this.db
      .from("characters")
      .insert({
        id,
        ...(input.createdAt ? { created_at: input.createdAt } : {}),
        description: input.description,
        prompt: input.prompt,
        storage_path: storagePath,
        source_url: input.imageUrl.startsWith("data:") ? null : input.imageUrl,
        width: input.width,
        height: input.height,
        style: input.style,
        quality: input.quality,
        model: input.model,
        face: input.face ?? null,
      })
      .select(CHARACTER_COLUMNS)
      .single();
    if (error) throw new Error(`Couldn't save the character: ${error.message}`);
    const sign = await this.signAll([storagePath]);
    this.emit();
    return this.toCharacter(data as CharacterRow, sign);
  }

  async getCharacter(id: string) {
    const { data, error } = await this.db.from("characters").select(CHARACTER_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as CharacterRow;
    return this.toCharacter(row, await this.signAll([row.storage_path]));
  }

  async listCharacters() {
    const { data, error } = await this.db
      .from("characters")
      .select(CHARACTER_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CharacterRow[];
    const sign = await this.signAll(rows.map((r) => r.storage_path));
    return rows.map((r) => this.toCharacter(r, sign));
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
