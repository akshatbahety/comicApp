import type { GenerationSettings, Script } from "@/lib/types";
import type { BillingStatus } from "./status";

/** Browser helpers for the paid plan (F-019). The server enforces it regardless. */

/** Offline placeholder art costs nothing, so mock mode never asks for payment. */
export const billingEnabled = process.env.NEXT_PUBLIC_AI_MODE !== "mock";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const post = (path: string, body: unknown = {}) =>
  call<{ url: string }>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getBillingStatus = () => call<BillingStatus>("/api/billing/status", { cache: "no-store" });
export const startCheckout = (next: string) => post("/api/billing/checkout", { next });
export const openBillingPortal = () => post("/api/billing/portal");
export const confirmSubscription = (subscriptionId: string) =>
  call<{ status: string }>("/api/billing/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriptionId }),
  });

export const imagesLeft = (s: BillingStatus) => Math.max(0, s.limit - s.used);

/**
 * The Create page's work-in-progress, kept across the trip to Dodo's hosted
 * checkout so the user comes back to their reviewed script, not an empty form.
 */
export interface CreateDraft {
  idea: string;
  settings: GenerationSettings;
  script: Script | null;
  baseline: Script | null;
  scriptKey: string | null;
}

const DRAFT_KEY = "panelforge:create-draft";

export function saveDraft(draft: CreateDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the user just re-enters their idea.
  }
}

/** Returns and forgets the saved draft. */
export function takeDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    const draft = raw ? (JSON.parse(raw) as CreateDraft) : null;
    return draft && typeof draft.idea === "string" && draft.settings ? draft : null;
  } catch {
    return null;
  }
}
