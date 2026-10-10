import { useMemo } from "react";
import { i18n } from "@/lib/i18n";
import { useStories } from "@/hooks/useStories";
import { groupStoriesBySlot } from "./homeWeek";

/** UI locale of the stories (the debug locale reads the French ones). */
export const storiesLocale = () => (i18n.getCurrentLocale() === "en" ? "en" : "fr");

/**
 * Stories of a program week grouped by slot. Same query key for every caller of a week,
 * so the home blocks share one request.
 */
export const useWeekStories = (week: number) => {
  // 6 ages x 7 days, with room for series aliases
  const query = useStories({ page: 1, limit: 100, locale: storiesLocale(), weekNumber: String(week) });
  const slots = useMemo(() => groupStoriesBySlot(query.data?.data ?? []), [query.data]);
  return { ...query, slots };
};
