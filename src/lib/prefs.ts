import { LANGUAGES, type LanguageId } from "./presets";

/**
 * Per-browser UI preferences (F-018). Deliberately outside the Repository and
 * the `panelforge:v1` data key: they are not comic data. Storage failures are
 * swallowed, so a blocked localStorage just means nothing is remembered.
 */
const KEY = "panelforge:prefs";

export interface Prefs {
  language?: LanguageId;
}

const isLanguage = (v: unknown): v is LanguageId => LANGUAGES.some((l) => l.id === v);

export function getPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    const language = (parsed as Prefs | null)?.language;
    return isLanguage(language) ? { language } : {};
  } catch {
    return {};
  }
}

export function setPrefs(patch: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getPrefs(), ...patch }));
  } catch {
    // Not remembered this time; the picker still works for the session.
  }
}
