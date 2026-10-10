import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { getAgeGroupColor } from "@/lib/utils";
import { AGE_GROUPS } from "@/types/Story";
import { currentIsoWeek } from "@/utils/weekUtils";
import { generationLink, slotKey, todayDayOrder } from "./homeWeek";
import { useWeekStories } from "./useWeekStories";
import { HomeCard, HomeError } from "./HomeCard";

const cardClass =
  "group flex min-h-[4.5rem] items-center gap-3 rounded-xl border p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

/**
 * TodayStories Component
 *
 * Today's story of each age group, to open and read it; a missing one leads to its generation.
 */
const TodayStories = () => {
  const { t } = i18n;
  const { week } = currentIsoWeek();
  const day = todayDayOrder();
  const { slots, isLoading, isError, refetch } = useWeekStories(week);

  return (
    <HomeCard
      title={t("home.todayTitle")}
      actions={
        <Link to={`/stories?weekNumber=${week}`} className="rounded-md text-sm font-semibold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
          {t("home.todayAll")}
        </Link>
      }
    >
      {isError ? (
        <HomeError message={t("home.weekError")} onRetry={() => void refetch()} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {AGE_GROUPS.map((age) => {
            const ageLabel = t(`ages.${age}`);
            if (isLoading) {
              return <li key={age} aria-hidden="true" className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
            }

            const [story, ...others] = slots.get(slotKey(age, day)) ?? [];
            if (!story) {
              return (
                <li key={age}>
                  <Link
                    to={generationLink([week], [age])}
                    className={`${cardClass} border-dashed border-amber-300 bg-amber-50/60 text-amber-900 hover:bg-amber-50 dark:border-amber-300/30 dark:bg-amber-400/5 dark:text-amber-200 dark:hover:bg-amber-400/10`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-400/15">
                      <Sparkles aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">{ageLabel}</span>
                      <span className="block text-sm">{t("home.todayMissing")}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold underline-offset-2 group-hover:underline">{t("home.generate")}</span>
                  </Link>
                </li>
              );
            }

            const image = story.illustrations?.[0]?.image_path;
            const toReview = story.review_status === "to_review";
            return (
              <li key={age}>
                <Link
                  to={`/stories/${story.id}`}
                  className={`${cardClass} border-slate-200/80 bg-white hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-white/10 dark:bg-slate-950/30 dark:hover:border-indigo-300/30 dark:hover:bg-slate-900`}
                >
                  {image ? (
                    <img src={`/${image}`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${getAgeGroupColor(age)}`}>
                      <BookOpen aria-hidden="true" className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {ageLabel}
                      {toReview && (
                        <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
                          {t("home.toReview")}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{story.title}</span>
                    {others.length > 0 && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{t("home.todayOthers", { count: String(others.length) })}</span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
};

export default TodayStories;
