import { addWeeks, endOfISOWeek, format, getISOWeek, getISOWeeksInYear, getISOWeekYear, startOfISOWeek } from "date-fns";
import { enUS, fr } from "date-fns/locale";

const DATE_LOCALES = { fr, en: enUS } as const;

/** date-fns locale of an UI locale ("fr", "en"...), French by default. */
export const dateLocale = (locale: string) => DATE_LOCALES[locale as keyof typeof DATE_LOCALES] ?? fr;

/** Monday and Sunday of ISO week `week` of `year`. */
export const isoWeekRange = (week: number, year: number) => {
  // ISO week 1 is the week containing January 4th
  const start = addWeeks(startOfISOWeek(new Date(year, 0, 4)), week - 1);
  return { start, end: endOfISOWeek(start) };
};

/** ISO week and week-year of a date. */
export const currentIsoWeek = (date = new Date()) => ({ week: getISOWeek(date), year: getISOWeekYear(date) });

/** 52 or 53. */
export const weeksInIsoYear = (year: number) => getISOWeeksInYear(new Date(year, 5, 1));

/** "6 – 12 janv." style label of a week. */
export const formatWeekRange = (week: number, year: number, locale: string) => {
  const { start, end } = isoWeekRange(week, year);
  const options = { locale: dateLocale(locale) };
  const sameMonth = start.getMonth() === end.getMonth();
  return `${format(start, sameMonth ? "d" : "d MMM", options)} – ${format(end, "d MMM", options)}`;
};

/** Month (0-11) a week belongs to, by its Thursday (ISO rule). */
export const weekMonth = (week: number, year: number) => {
  const { start } = isoWeekRange(week, year);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3).getMonth();
};
