export const AI_TIMEOUT_LIMITS_SECONDS = {
  gemini: 900,
  geminiWeek: 1800,
  ollama: 3600,
} as const;

export type AiTimeoutKey = keyof typeof AI_TIMEOUT_LIMITS_SECONDS;

export const isValidAiTimeoutSeconds = (key: AiTimeoutKey, value: string) => (
  value.trim() === "" ||
  (Number.isFinite(Number(value)) &&
    Number(value) >= 10 &&
    Number(value) <= AI_TIMEOUT_LIMITS_SECONDS[key] &&
    Number.isInteger(Number(value) * 1000))
);
