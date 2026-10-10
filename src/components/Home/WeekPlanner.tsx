import { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Eye, Plus, Sparkles } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { AGE_GROUPS } from "@/types/Story";
import { currentIsoWeek, dateLocale, formatWeekRange, isoWeekRange, weeksInIsoYear } from "@/utils/weekUtils";
import { DAY_KEYS, generationLink, missingSlots, shiftWeek, slotKey, todayDayOrder, WEEK_SLOTS } from "./homeWeek";
import { storiesLocale, useWeekStories } from "./useWeekStories";
import { HomeCard, HomeError } from "./HomeCard";

const navButtonClass =
  "inline-flex h-8 items-center whitespace-nowrap justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const cellClass = "flex h-9 w-full min-w-0 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

/**
 * WeekPlanner Component
 *
 * Ages x days table of a program week: open a story, see what waits for a review,
 * generate the missing ones (one age or the whole week). Today's column is highlighted.
 */
const WeekPlanner = () => {
  const { t } = i18n;
  const locale = storiesLocale();
  const current = currentIsoWeek();
  const weeksInYear = weeksInIsoYear(current.year);
  const [week, setWeek] = useState(current.week);
  const isCurrentWeek = week === current.week;
  const today = isCurrentWeek ? todayDayOrder() : null;

  const { slots, isLoading, isError, refetch } = useWeekStories(week);
  const missing = missingSlots(slots);
  const covered = WEEK_SLOTS - missing.count;

  const { start } = isoWeekRange(week, current.year);
  const days = DAY_KEYS.map((key, i) => ({
    order: i + 1,
    label: t(`days.${key}`),
    short: t(`days.${key}`).slice(0, 2),
    date: format(addDays(start, i), "d", { locale: dateLocale(locale) }),
  }));

  return (
    <HomeCard
      title={t("home.plannerTitle")}
      actions={
        <div className="flex items-center gap-1.5">
          <button type="button" className={navButtonClass} onClick={() => setWeek(shiftWeek(week, -1, weeksInYear))} aria-label={t("home.plannerPrevious")}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <span className="whitespace-nowrap text-center text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100 sm:min-w-[9.5rem]" aria-live="polite">
            {t("home.weekLabel", { week: String(week) })}
            <span className="hidden sm:inline"> · {formatWeekRange(week, current.year, locale)}</span>
          </span>
          <button type="button" className={navButtonClass} onClick={() => setWeek(shiftWeek(week, 1, weeksInYear))} aria-label={t("home.plannerNext")}>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <button type="button" className={navButtonClass} onClick={() => setWeek(current.week)} disabled={isCurrentWeek}>
            {t("home.plannerToday")}
          </button>
        </div>
      }
    >
      {isError ? (
        <HomeError message={t("home.weekError")} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                {t("home.legendAvailable")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye aria-hidden="true" className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                {t("home.legendReview")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Plus aria-hidden="true" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                {t("home.legendMissing")}
              </span>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-3 text-sm">
                <span className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                  {t("home.plannerCovered", { covered: String(covered), total: String(WEEK_SLOTS) })}
                </span>
                {missing.count > 0 && (
                  <Link
                    to={generationLink([week], missing.ages)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25"
                  >
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                    {t("home.plannerGenerate", { count: String(missing.count) })}
                  </Link>
                )}
              </div>
            )}
          </div>

          <table className="w-full table-fixed border-separate border-spacing-1">
            <caption className="sr-only">{t("home.plannerCaption", { week: String(week) })}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[4.25rem] sm:w-24"><span className="sr-only">{t("home.plannerAge")}</span></th>
                {days.map((day) => (
                  <th
                    key={day.order}
                    scope="col"
                    abbr={day.label}
                    className={`rounded-md py-1 text-center text-[11px] font-semibold sm:text-xs ${day.order === today ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    <span className="block">{day.short}</span>
                    <span className="block font-normal tabular-nums">{day.date}</span>
                  </th>
                ))}
                <th scope="col" className="hidden w-10 sm:table-cell"><span className="sr-only">{t("home.plannerDaysCovered")}</span></th>
              </tr>
            </thead>
            <tbody>
              {AGE_GROUPS.map((age) => {
                const ageLabel = t(`ages.${age}`);
                const coveredDays = days.filter((day) => slots.has(slotKey(age, day.order))).length;
                return (
                  <tr key={age}>
                    <th scope="row" className="whitespace-nowrap text-left text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                      <Link to={`/stories?weekNumber=${week}&ageGroup=${age}`} className="rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300">
                        {ageLabel}
                      </Link>
                    </th>
                    {days.map((day) => {
                      const todayRing = day.order === today ? "ring-2 ring-indigo-500/60 ring-offset-1 ring-offset-white dark:ring-offset-slate-900" : "";
                      if (isLoading) {
                        return (
                          <td key={day.order}>
                            <div className={`h-9 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800 ${todayRing}`} />
                          </td>
                        );
                      }
                      const [story] = slots.get(slotKey(age, day.order)) ?? [];
                      if (!story) {
                        const label = t("home.cellMissing", { day: day.label, age: ageLabel });
                        return (
                          <td key={day.order}>
                            <Link
                              to={generationLink([week], [age])}
                              aria-label={label}
                              title={label}
                              className={`${cellClass} ${todayRing} border-dashed border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-400/5 dark:text-amber-300 dark:hover:bg-amber-400/15`}
                            >
                              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        );
                      }
                      const toReview = story.review_status === "to_review";
                      const label = t(toReview ? "home.cellReview" : "home.cellAvailable", { day: day.label, age: ageLabel, title: story.title });
                      return (
                        <td key={day.order}>
                          <Link
                            to={`/stories/${story.id}`}
                            aria-label={label}
                            title={label}
                            className={`${cellClass} ${todayRing} ${
                              toReview
                                ? "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:hover:bg-indigo-400/20"
                                : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20"
                            }`}
                          >
                            {toReview ? <Eye aria-hidden="true" className="h-3.5 w-3.5" /> : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                          </Link>
                        </td>
                      );
                    })}
                    <td className="hidden text-right text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 sm:table-cell">
                      {isLoading ? "" : `${coveredDays}/${days.length}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </HomeCard>
  );
};

export default WeekPlanner;
