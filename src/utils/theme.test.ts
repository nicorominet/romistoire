import { describe, it, expect } from "vitest";
import { normalizeThemeName, isSameThemeName, findSimilarThemes, matchesThemeSearch } from "./themeName";
import { parseHexColor, safeThemeColor, readableTextColor, tint, themeBadgeStyle, FALLBACK_THEME_COLOR } from "./themeColors";

describe("themeName (mirror of the server helper)", () => {
  it.each([
    ["L'Amitié !", "amitie"],
    ["Les  Océans", "oceans"],
    ["  la Forêt-Noire ", "foret noire"],
    ["The Moon", "moon"],
  ])("normalizes %s to %s", (name, expected) => {
    expect(normalizeThemeName(name)).toBe(expected);
  });

  it("matches case, accents, articles and plurals", () => {
    expect(isSameThemeName("Océan", "les oceans")).toBe(true);
    expect(isSameThemeName("Animal", "Animaux")).toBe(true);
    expect(isSameThemeName("Nature", "Natation")).toBe(false);
    expect(findSimilarThemes("ocean", [{ name: "Océans" }, { name: "Mer" }])).toEqual([{ name: "Océans" }]);
  });

  it("searches without accents", () => {
    expect(matchesThemeSearch("Écologie", "eco")).toBe(true);
    expect(matchesThemeSearch("Écologie", "mer")).toBe(false);
    expect(matchesThemeSearch("Écologie", "")).toBe(true);
  });
});

describe("themeColors", () => {
  it("parses 3 and 6 digit codes", () => {
    expect(parseHexColor("#abc")).toEqual([170, 187, 204]);
    expect(parseHexColor("4CAF50")).toEqual([76, 175, 80]);
    expect(parseHexColor("red")).toBeNull();
    expect(safeThemeColor("nope")).toBe(FALLBACK_THEME_COLOR);
    expect(safeThemeColor("#ABC")).toBe("#aabbcc");
  });

  it("picks a readable text color on solid backgrounds", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#ffeb3b")).toBe("#000000");
    expect(readableTextColor("#1e3a8a")).toBe("#ffffff");
  });

  it("builds tinted badge colors", () => {
    expect(tint("#4CAF50", 0.12)).toBe("rgba(76, 175, 80, 0.12)");
    expect(themeBadgeStyle("#1e3a8a", "soft").color).toBe("#1e3a8a");
    expect(themeBadgeStyle("#ffeb3b", "soft").color).toContain("color-mix");
    expect(themeBadgeStyle("#ffffff", "solid")).toEqual({ backgroundColor: "#ffffff", color: "#000000", borderColor: "#ffffff" });
  });
});
