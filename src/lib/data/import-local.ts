"use client";

import { LocalRepository } from "./local-repository";
import type { SupabaseRepository } from "./supabase-repository";

/** Set once this browser's local comics have been copied into an account. */
const DONE_KEY = "panelforge:imported";

export interface ImportResult {
  comics: number;
  images: number;
  skippedImages: number;
}

function alreadyImported() {
  try {
    return localStorage.getItem(DONE_KEY) !== null;
  } catch {
    return true; // No storage access: nothing to import either.
  }
}

/**
 * Copies comics saved in this browser before F-010 into the signed-in account,
 * once per browser. Images whose fal links have expired are skipped; the comic,
 * its idea, script and settings are kept. Local data is left in place.
 */
let running: Promise<ImportResult | null> | null = null;

export function importLocalComics(target: SupabaseRepository, userId: string): Promise<ImportResult | null> {
  // Sign-in fires more than one auth event; only the first starts an import.
  running ??= runImport(target, userId);
  return running;
}

async function runImport(target: SupabaseRepository, userId: string): Promise<ImportResult | null> {
  if (alreadyImported()) return null;
  const local = new LocalRepository();
  const generations = await local.listGenerations();
  const mark = () => {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify({ userId, at: new Date().toISOString() }));
    } catch {}
  };
  if (!generations.length) {
    mark();
    return null;
  }
  // Mark first, so two tabs or a reload mid-import can't import twice.
  mark();

  const result: ImportResult = { comics: 0, images: 0, skippedImages: 0 };
  const characterIds = new Map<string, string | undefined>();

  for (const { generation, images, character } of generations.reverse()) {
    let characterId: string | undefined;
    if (character) {
      if (!characterIds.has(character.id)) {
        const { id, createdAt, ...rest } = character;
        const saved = await target
          .createCharacter({ ...rest, id: crypto.randomUUID(), createdAt })
          .catch(() => null);
        if (!saved) result.skippedImages++;
        characterIds.set(id, saved?.id);
      }
      characterId = characterIds.get(character.id);
    }

    const created = await target.createGeneration({
      title: generation.title,
      idea: generation.idea,
      script: generation.script,
      settings: generation.settings,
      model: generation.model,
      saved: generation.saved,
      ...(generation.error ? { error: generation.error } : {}),
      ...(characterId ? { characterId } : {}),
      status: generation.status === "pending" ? "failed" : generation.status,
      createdAt: generation.createdAt,
    });
    result.comics++;

    for (const img of images) {
      const ok = await target
        .addImage({
          generationId: created.id,
          panelIndex: img.panelIndex,
          prompt: img.prompt,
          caption: img.caption,
          url: img.url,
          width: img.width,
          height: img.height,
          createdAt: img.createdAt,
        })
        .then(() => true, () => false);
      if (ok) result.images++;
      else result.skippedImages++;
    }
  }
  return result;
}
