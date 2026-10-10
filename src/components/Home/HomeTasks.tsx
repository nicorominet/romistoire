import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, ChevronRight, Eye, ImageOff, Loader2, Sparkles, type LucideIcon } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { useStories } from "@/hooks/useStories";
import { useWeeklyThemes } from "@/hooks/useThemes";
import { isActiveJob, useGenerationJobs } from "@/hooks/useGenerationJobs";
import { WeeklyTheme } from "@/types/Theme";
import { currentIsoWeek, weeksInIsoYear } from "@/utils/weekUtils";
import { generationLink, missingSlots, shiftWeek } from "./homeWeek";
import { storiesLocale, useWeekStories } from "./useWeekStories";
import { HomeCard, HomeError } from "./HomeCard";

interface Task {
  key: string;
  to: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  tone: string;
}

/**
 * HomeTasks Component
 *
 * What is left to do, most urgent first: running generation, stories to review, gaps of this week,
 * preparation of next week, stories without illustration. Done tasks are hidden.
 */
const HomeTasks = () => {
  const { t } = i18n;
  const locale = storiesLocale();
  const { week, year } = currentIsoWeek();
  const nextWeek = shiftWeek(week, 1, weeksInIsoYear(year));

  const jobsQuery = useGenerationJobs();
  const reviewQuery = useStories({ page: 1, limit: 1, locale, reviewStatus: "to_review" });
  const noImageQuery = useStories({ page: 1, limit: 1, locale, hasImage: "no" });
  const thisWeekQuery = useWeekStories(week);
  const nextWeekQuery = useWeekStories(nextWeek);
  const themesQuery = useWeeklyThemes();

  const queries = [jobsQuery, reviewQuery, noImageQuery, thisWeekQuery, nextWeekQuery, themesQuery];
  const isLoading = queries.some((query) => query.isLoading);
  const failed = queries.filter((query) => query.isError);

  const tasks: Task[] = [];

  const jobs = jobsQuery.data ?? [];
  const activeJob = jobs.find((job) => job.status === "running") || jobs.find(isActiveJob);
  if (activeJob) {
    const percent = activeJob.totalUnits > 0 ? Math.round((activeJob.doneUnits / activeJob.totalUnits) * 100) : 0;
    tasks.push({
      key: "job",
      to: `${APP_ROUTES.GENERATION}?tab=jobs&job=${activeJob.id}`,
      icon: Loader2,
      label: t("home.taskJob", { percent: String(percent) }),
      detail: activeJob.currentLabel ?? undefined,
      tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300 [&>svg]:animate-spin",
    });
  }

  const toReview = reviewQuery.data?.total ?? 0;
  if (toReview > 0) {
    tasks.push({
      key: "review",
      to: "/stories?reviewStatus=to_review",
      icon: Eye,
      label: t(toReview > 1 ? "home.taskReview" : "home.taskReviewOne", { count: String(toReview) }),
      detail: t("home.taskReviewDetail"),
      tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    });
  }

  if (thisWeekQuery.data) {
    const missing = missingSlots(thisWeekQuery.slots);
    if (missing.count > 0) {
      tasks.push({
        key: "this-week",
        to: generationLink([week], missing.ages),
        icon: Sparkles,
        label: t("home.taskThisWeek", { count: String(missing.count) }),
        detail: t("home.taskGenerateDetail"),
        tone: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
      });
    }
  }

  const hasNextTopic = (themesQuery.data as WeeklyTheme[] | undefined)?.some((theme) => theme.week_number === nextWeek);
  if (themesQuery.data && !hasNextTopic) {
    tasks.push({
      key: "next-topic",
      to: APP_ROUTES.WEEKLY_THEMES,
      icon: CalendarClock,
      label: t("home.taskNextTopic", { week: String(nextWeek) }),
      detail: t("home.taskNextTopicDetail"),
      tone: "bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
    });
  } else if (nextWeekQuery.data) {
    const missing = missingSlots(nextWeekQuery.slots);
    if (missing.count > 0) {
      tasks.push({
        key: "next-week",
        to: generationLink([nextWeek], missing.ages),
        icon: CalendarClock,
        label: t("home.taskNextWeek", { week: String(nextWeek), count: String(missing.count) }),
        detail: t("home.taskGenerateDetail"),
        tone: "bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
      });
    }
  }

  const noImage = noImageQuery.data?.total ?? 0;
  if (noImage > 0) {
    tasks.push({
      key: "no-image",
      to: APP_ROUTES.ILLUSTRATIONS,
      icon: ImageOff,
      label: t(noImage > 1 ? "home.taskNoImage" : "home.taskNoImageOne", { count: String(noImage) }),
      detail: t("home.taskNoImageDetail"),
      tone: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
    });
  }

  return (
    <HomeCard title={t("home.tasksTitle")}>
      <div className="space-y-2">
        {failed.length > 0 && (
          <HomeError message={t("home.tasksError")} onRetry={() => failed.forEach((query) => void query.refetch())} />
        )}
        {isLoading && tasks.length === 0 ? (
          <div className="space-y-2" aria-label={t("common.loading")}>
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
          </div>
        ) : tasks.length === 0 && failed.length === 0 ? (
          <p className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t("home.tasksDone")}
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map(({ key, to, icon: Icon, label, detail, tone }) => (
              <li key={key}>
                <Link
                  to={to}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-slate-950/30 dark:hover:border-indigo-300/30 dark:hover:bg-slate-900"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
                    {detail && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</span>}
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HomeCard>
  );
};

export default HomeTasks;
