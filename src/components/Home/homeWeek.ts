import { APP_ROUTES } from "@/constants";
import { AGE_GROUPS, Story } from "@/types/Story";

/** Days of the program, in week order (day_order 1 = Monday). */
export const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

/** Slots of a week: one story per age group and per day. */
export const WEEK_SLOTS = AGE_GROUPS.length * DAY_KEYS.length;

/** day_order (1 = Monday … 7 = Sunday) of a date. */
export const todayDayOrder = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;

export const slotKey = (ageGroup: string, dayOrder: number) => `${ageGroup}:${dayOrder}`;

/** Stories of a week grouped by slot ("age:day"). A slot can hold several stories (series aliases). */
export const groupStoriesBySlot = (stories: Story[]) => {
  const slots = new Map<string, Story[]>();
  stories.forEach((story) => {
    const key = slotKey(String(story.age_group), Number(story.day_order));
    slots.set(key, [...(slots.get(key) ?? []), story]);
  });
  return slots;
};

/** Age groups having at least one empty day, and the number of empty slots. */
export const missingSlots = (slots: Map<string, Story[]>) => {
  const ages = AGE_GROUPS.filter((age) => DAY_KEYS.some((_, i) => !slots.has(slotKey(age, i + 1))));
  const count = AGE_GROUPS.reduce(
    (total, age) => total + DAY_KEYS.filter((_, i) => !slots.has(slotKey(age, i + 1))).length,
    0,
  );
  return { ages, count };
};

/** Week `delta` weeks away; the program is cyclic (1 … weeksInYear). */
export const shiftWeek = (week: number, delta: number, weeksInYear: number) =>
  ((((week - 1 + delta) % weeksInYear) + weeksInYear) % weeksInYear) + 1;

/** Generation page with its form pre-filled (whole week, existing stories skipped). */
export const generationLink = (weeks: number[], ages: readonly string[]) =>
  `${APP_ROUTES.GENERATION}?weeks=${weeks.join(",")}&ages=${ages.join(",")}`;
