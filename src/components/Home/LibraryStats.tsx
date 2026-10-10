import { Link } from "react-router-dom";
import { BookOpen, Layers3, Palette, RefreshCw, Tags } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { useStories } from "@/hooks/useStories";
import { useThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { storiesLocale } from "./useWeekStories";

/**
 * LibraryStats Component
 *
 * Thin band of library counts, each one opening the matching list.
 * Stories follow the UI language; themes and series are shared by all languages.
 */
const LibraryStats = () => {
  const { t } = i18n;
  const locale = storiesLocale();
  const storiesQuery = useStories({ page: 1, limit: 1, locale });
  const illustratedQuery = useStories({ page: 1, limit: 1, locale, hasImage: "yes" });
  const themesQuery = useThemes();
  const seriesQuery = useSeries();

  const stats = [
    { label: t("home.statsStories"), icon: BookOpen, value: storiesQuery.data?.total, query: storiesQuery, to: "/stories" },
    { label: t("home.statsIllustrated"), icon: Palette, value: illustratedQuery.data?.total, query: illustratedQuery, to: "/stories?hasImage=yes" },
    { label: t("home.statsThemes"), icon: Tags, value: themesQuery.data?.length, query: themesQuery, to: APP_ROUTES.THEMES },
    { label: t("home.statsSeries"), icon: Layers3, value: seriesQuery.data?.length, query: seriesQuery, to: APP_ROUTES.SERIES_MANAGEMENT },
  ];

  return (
    <nav aria-label={t("home.libraryTitle")} className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
      <span className="mr-2 font-semibold text-slate-800 dark:text-slate-100">{t("home.libraryTitle")}</span>
      {stats.map(({ label, icon: Icon, value, query, to }) =>
        query.isError ? (
          <button
            key={label}
            type="button"
            onClick={() => void query.refetch()}
            title={t("home.retry")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-rose-300 dark:hover:bg-rose-400/10"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {label}
          </button>
        ) : (
          <Link
            key={label}
            to={to}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-white/80 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/5 dark:hover:text-indigo-300"
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{query.isLoading ? "…" : value ?? "—"}</span>
            {label}
          </Link>
        ),
      )}
    </nav>
  );
};

export default LibraryStats;
