import { getISOWeek } from "date-fns";
import { currentIsoWeek, isoWeekRange } from "@/utils/weekUtils";

/** A week far behind the current one belongs to next year's program (server rule: PromptHelper.yearOfWeek). */
const BEHIND_WEEKS = 8;

/** Year of a week of the program. */
export const programYear = (week: number, now = new Date()) => {
  const current = currentIsoWeek(now);
  return week < current.week - BEHIND_WEEKS ? current.year + 1 : current.year;
};

/** Thursday of a week of the program (the day that sets its year and month). */
const thursdayOf = (week: number, now = new Date()) => {
  const { start } = isoWeekRange(week, programYear(week, now));
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3);
};

/** Birthdays ("MM-DD") strictly after `from` and up to `to`. */
const birthdaysBetween = (birthday: string, from: Date, to: Date) => {
  const [month, day] = birthday.split("-").map(Number);
  let count = 0;
  for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
    const date = new Date(year, month - 1, day);
    if (date > from && date <= to) count++;
  }
  return count;
};

/**
 * Age of a character during a week of the program: its age at the reference week, plus the birthdays passed since
 * (same rule as the server, ageAtWeek in cast_validation.helper.js).
 */
export const ageAtWeek = (age: number | null, birthday: string | null, week: number, referenceWeek: number, now = new Date(), dayOffset = 0) => {
  if (age === null) return null;
  if (!birthday || !/^\d{2}-\d{2}$/.test(birthday)) return age;
  const reference = thursdayOf(referenceWeek, now);
  // dayOffset: days after the Thursday (3: the Sunday, once a birthday of the week has passed)
  const thursday = thursdayOf(week, now);
  const target = new Date(thursday.getFullYear(), thursday.getMonth(), thursday.getDate() + dayOffset);
  return target >= reference ? age + birthdaysBetween(birthday, reference, target) : age - birthdaysBetween(birthday, target, reference);
};

/** ISO week of the next birthday ("MM-DD") from today. */
export const nextBirthdayWeek = (birthday: string, now = new Date()) => {
  const [month, day] = birthday.split("-").map(Number);
  let date = new Date(now.getFullYear(), month - 1, day);
  if (date < now) date = new Date(now.getFullYear() + 1, month - 1, day);
  return getISOWeek(date);
};
