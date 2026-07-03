import { describe, it, expect } from "vitest";
import { saveSettings, loadSettings, SETTINGS_KEY } from "./persist";
import { defaultSettings } from "./store";

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

describe("settings persistence", () => {
  it("round-trips settings", () => {
    const storage = memStorage();
    const s = { ...defaultSettings(), columns: 5, format: "png" as const };
    saveSettings(s, storage);
    expect(loadSettings(storage)).toEqual(s);
  });

  it("returns null when nothing is stored", () => {
    expect(loadSettings(memStorage())).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    expect(loadSettings(memStorage({ [SETTINGS_KEY]: "{not json" }))).toBeNull();
  });

  it("drops unknown keys and defaults missing ones", () => {
    const stored = JSON.stringify({ columns: 4, bogus: true });
    const s = loadSettings(memStorage({ [SETTINGS_KEY]: stored }))!;
    expect(s.columns).toBe(4);
    expect(s.gridWidth).toBe(defaultSettings().gridWidth);
    expect("bogus" in s).toBe(false);
  });

  it("rejects wrong types and invalid enum values field-by-field", () => {
    const stored = JSON.stringify({ columns: "three", layout: "diagonal", quality: 0.5 });
    const s = loadSettings(memStorage({ [SETTINGS_KEY]: stored }))!;
    expect(s.columns).toBe(defaultSettings().columns);
    expect(s.layout).toBe(defaultSettings().layout);
    expect(s.quality).toBe(0.5);
  });

  it("returns null when the merged result fails validateSettings", () => {
    const stored = JSON.stringify({ columns: 0 });
    // columns 0 passes the type check but validateSettings rejects it.
    expect(loadSettings(memStorage({ [SETTINGS_KEY]: stored }))).toBeNull();
  });

  it("no-ops when storage is unavailable", () => {
    expect(() => saveSettings(defaultSettings(), undefined as never)).not.toThrow();
    expect(loadSettings(undefined as never)).toBeNull();
  });
});
