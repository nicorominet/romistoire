import { describe, expect, it } from "vitest";
import { Story } from "@/types/Story";
import { generationLink, groupStoriesBySlot, missingSlots, shiftWeek, todayDayOrder, WEEK_SLOTS } from "./homeWeek";

const story = (age_group: string, day_order: number, id = `${age_group}-${day_order}`) => ({ id, age_group, day_order }) as Story;

describe("homeWeek", () => {
  it("numbers days from Monday (1) to Sunday (7)", () => {
    expect(todayDayOrder(new Date(2026, 9, 5))).toBe(1); // Monday
    expect(todayDayOrder(new Date(2026, 9, 8))).toBe(4); // Thursday
    expect(todayDayOrder(new Date(2026, 9, 11))).toBe(7); // Sunday
  });

  it("wraps weeks around the year", () => {
    expect(shiftWeek(41, 1, 53)).toBe(42);
    expect(shiftWeek(52, 1, 52)).toBe(1);
    expect(shiftWeek(53, 1, 53)).toBe(1);
    expect(shiftWeek(1, -1, 52)).toBe(52);
    expect(shiftWeek(1, -1, 53)).toBe(53);
  });

  it("groups stories by slot and counts the empty ones", () => {
    const slots = groupStoriesBySlot([story("4-6", 1), story("4-6", 1, "alias"), story("2-3", 7)]);
    expect(slots.get("4-6:1")?.map((s) => s.id)).toEqual(["4-6-1", "alias"]);
    expect(slots.get("2-3:7")).toHaveLength(1);

    const missing = missingSlots(slots);
    expect(missing.count).toBe(WEEK_SLOTS - 2);
    expect(missing.ages).toEqual(["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"]);
  });

  it("builds a pre-filled generation link", () => {
    expect(generationLink([41], ["4-6", "7-9"])).toBe("/generation?weeks=41&ages=4-6,7-9");
  });
});
