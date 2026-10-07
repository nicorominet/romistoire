import { i18n } from "@/lib/i18n";

/**
 * Standard English day names.
 */
export const DAY_NAMES_EN = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;

export type DayNameEn = typeof DAY_NAMES_EN[number];

/**
 * Maps day index (1-7, where 1=Monday) or English name to order.
 */
export const getDayOrder = (day: string | number): number => {
  if (typeof day === "number") return day;
  const index = DAY_NAMES_EN.indexOf(day as DayNameEn);
  return index !== -1 ? index + 1 : 1;
};

/**
 * Maps English day name to localized label.
 */
export const getDayLabel = (day: string): string => {
  const { t } = i18n;
  const lower = day.toLowerCase();
  if (lower === "monday") return t("days.monday");
  if (lower === "tuesday") return t("days.tuesday");
  if (lower === "wednesday") return t("days.wednesday");
  if (lower === "thursday") return t("days.thursday");
  if (lower === "friday") return t("days.friday");
  if (lower === "saturday") return t("days.saturday");
  if (lower === "sunday") return t("days.sunday");
  return day;
};

/**
 * Maps French day name to English day name.
 * Tolerant to AI output variations: case, accents, surrounding punctuation ("lundi.", "**Mardi**").
 */
export const mapFrToEnDay = (frDay: string): string => {
  const map: Record<string, string> = {
    "lundi": "Monday",
    "mardi": "Tuesday",
    "mercredi": "Wednesday",
    "jeudi": "Thursday",
    "vendredi": "Friday",
    "samedi": "Saturday",
    "dimanche": "Sunday",
    "toute la semaine": "Monday" // Default for batches
  };
  if (!frDay) return frDay;
  const normalized = frDay
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[*[\]().,;:!]/g, "")
    .trim()
    .toLowerCase();
  const englishDay = DAY_NAMES_EN.find(day => day.toLowerCase() === normalized);
  return map[normalized] || englishDay || frDay;
};
