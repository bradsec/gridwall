import { describe, it, expect } from "vitest";
import type { Settings } from "./types";
import { validateSettings } from "./settings";

function base(): Settings {
  return {
    layout: "square", gridWidth: 900, maxGridHeight: 900, columns: 3,
    cropMode: "smart", addNames: false, limit: 0, perGrid: 0, format: "jpeg", quality: 0.9,
    borderThickness: 0, borderColor: "#000000", borderScope: "each",
  };
}

describe("validateSettings", () => {
  it("accepts defaults and valid crop modes", () => {
    expect(validateSettings(base())).toBeNull();
    expect(validateSettings({ ...base(), cropMode: "center" })).toBeNull();
    expect(validateSettings({ ...base(), cropMode: "top" })).toBeNull();
  });
  it("rejects invalid combinations", () => {
    expect(validateSettings({ ...base(), columns: 0 })).not.toBeNull();
    expect(validateSettings({ ...base(), columns: -1 })).not.toBeNull();
    expect(validateSettings({ ...base(), gridWidth: 0 })).not.toBeNull();
    expect(validateSettings({ ...base(), maxGridHeight: 0 })).not.toBeNull();
    expect(validateSettings({ ...base(), gridWidth: 2, columns: 3 })).not.toBeNull();
    expect(validateSettings({ ...base(), limit: -1 })).not.toBeNull();
    expect(validateSettings({ ...base(), perGrid: -1 })).not.toBeNull();
  });
  it("validates border settings", () => {
    expect(validateSettings({ ...base(), borderThickness: 10, borderColor: "#ABCDEF" })).toBeNull();
    expect(validateSettings({ ...base(), borderScope: "outside" })).toBeNull();
    expect(validateSettings({ ...base(), borderThickness: -1 })).not.toBeNull();
    expect(validateSettings({ ...base(), borderColor: "blue" })).not.toBeNull();
    expect(validateSettings({ ...base(), borderColor: "#FFF" })).not.toBeNull();
    expect(validateSettings({ ...base(), borderScope: "edges" as never })).not.toBeNull();
  });
});
