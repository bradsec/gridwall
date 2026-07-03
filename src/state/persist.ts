import type { Settings } from "../core/types";
import { defaultSettings } from "./store";
import { validateSettings } from "../core/settings";

export const SETTINGS_KEY = "gridwall.settings.v1";

// Allowed enum values per field; everything else is checked by typeof.
const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  layout: ["square", "masonry"],
  cropMode: ["smart", "center", "top"],
  format: ["jpeg", "png"],
  borderScope: ["each", "outside"],
};

function safeStorage(): Storage | null {
  // localStorage can throw on access in some private modes.
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveSettings(
  s: Settings,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Quota or availability failure: persistence is best-effort.
  }
}

export function loadSettings(
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): Settings | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(SETTINGS_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  // Field-by-field merge onto defaults: unknown keys dropped, wrong types and
  // invalid enum values fall back to the default for that field.
  const defaults = defaultSettings();
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    const value = (parsed as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const allowed = ENUMS[key];
    if (allowed) {
      if (typeof value === "string" && allowed.includes(value)) {
        (out as Record<string, unknown>)[key] = value;
      }
    } else if (typeof value === typeof defaults[key]) {
      (out as Record<string, unknown>)[key] = value;
    }
  }

  return validateSettings(out) === null ? out : null;
}
