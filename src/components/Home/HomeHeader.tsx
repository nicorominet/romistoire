import { Link } from "react-router-dom";
import { format } from "date-fns";
import { PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { useWeeklyThemes } from "@/hooks/useThemes";
import { WeeklyTheme } from "@/types/Theme";
import { currentIsoWeek, dateLocale, formatWeekRange } from "@/utils/weekUtils";
import { storiesLocale } from "./useWeekStories";

/**
 * HomeHeader Component
 *
 * Where we are (date, program week and its topic) and the two ways to add stories.
 */
const HomeHeader = () => {
  const { t } = i18n;
  const locale = storiesLocale();
  const { week, year } = currentIsoWeek();
  const { data: weeklyThemes = [], isLoading } = useWeeklyThemes();
  const topic = (weeklyThemes as WeeklyTheme[]).find((theme) => theme.week_number === week)?.theme_name;

  const today = format(new Date(), "EEEE d MMMM", { locale: dateLocale(locale) });

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold capitalize leading-tight tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          {today}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t("home.weekLabel", { week: String(week) })}</span>
          <span className="tabular-nums">{formatWeekRange(week, year, locale)}</span>
          <span aria-hidden="true">·</span>
          {isLoading ? (
            <span>…</span>
          ) : topic ? (
            <Link to={APP_ROUTES.WEEKLY_THEMES} className="rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300">
              {t("home.topic", { topic })}
            </Link>
          ) : (
            <Link to={APP_ROUTES.WEEKLY_THEMES} className="rounded-sm font-medium text-amber-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-amber-300">
              {t("home.noTopic")}
            </Link>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
          <Link to={APP_ROUTES.CREATE_STORY}>
            <PenLine aria-hidden="true" className="h-4 w-4" />
            {t("home.write")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-lg border-slate-300 bg-white/70 dark:border-white/15 dark:bg-white/5">
          <Link to={APP_ROUTES.GENERATION}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            {t("home.generate")}
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default HomeHeader;
