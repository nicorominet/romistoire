import { describe, expect, it } from "vitest";
import { AI_TIMEOUT_LIMITS_SECONDS, isValidAiTimeoutSeconds } from "./settingsValidation";

describe("AI timeout setting validation", () => {
  it.each([
    ["gemini", 900],
    ["geminiWeek", 1800],
    ["ollama", 3600],
  ] as const)("accepts the supported range for %s", (key, max) => {
    expect(isValidAiTimeoutSeconds(key, "10")).toBe(true);
    expect(isValidAiTimeoutSeconds(key, String(max))).toBe(true);
    expect(isValidAiTimeoutSeconds(key, "")).toBe(true);
    expect(AI_TIMEOUT_LIMITS_SECONDS[key]).toBe(max);
  });

  it.each([
    ["gemini", 900],
    ["geminiWeek", 1800],
    ["ollama", 3600],
  ] as const)("rejects values outside the server range for %s", (key, max) => {
    expect(isValidAiTimeoutSeconds(key, "9.999")).toBe(false);
    expect(isValidAiTimeoutSeconds(key, String(max + 1))).toBe(false);
    expect(isValidAiTimeoutSeconds(key, "abc")).toBe(false);
    expect(isValidAiTimeoutSeconds(key, "10.0001")).toBe(false);
  });
});
