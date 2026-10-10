import { useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import PageLayout from "@/components/Layout/PageLayout";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { ThemeLibrary, ThemeLibraryFilters, ThemeQuickFilter } from "@/components/Theme/ThemeLibrary";
import { ThemeSort } from "@/types/Theme";

const SORTS: ThemeSort[] = ["name", "usage", "recent"];
const QUICK_FILTERS: ThemeQuickFilter[] = ["all", "review", "unused"];

/**
 * Story themes (tags) page. Search, sort and quick filter live in the URL.
 * The topics of the weeks have their own page (/weekly-themes).
 */
const ThemesPage = () => {
  const { t } = i18n;
  const [searchParams, setSearchParams] = useSearchParams();

  const sortParam = searchParams.get("sort") as ThemeSort;
  const filterParam = searchParams.get("filter") as ThemeQuickFilter;
  const filters: ThemeLibraryFilters = {
    search: searchParams.get("q") ?? "",
    sort: SORTS.includes(sortParam) ? sortParam : "name",
    filter: QUICK_FILTERS.includes(filterParam) ? filterParam : "all",
  };

  const handleFiltersChange = useCallback((patch: Partial<ThemeLibraryFilters>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
      if (patch.search !== undefined) set("q", patch.search);
      if (patch.sort !== undefined) set("sort", patch.sort === "name" ? null : patch.sort);
      if (patch.filter !== undefined) set("filter", patch.filter === "all" ? null : patch.filter);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Old link to the calendar tab
  if (searchParams.get("tab") === "calendar") {
    const year = searchParams.get("year");
    return <Navigate to={`${APP_ROUTES.WEEKLY_THEMES}${year ? `?year=${year}` : ""}`} replace />;
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">{t("themes.pageTitle")}</h1>
          <p className="text-muted-foreground">{t("themes.pageSubtitle")}</p>
        </header>
        <ThemeLibrary filters={filters} onFiltersChange={handleFiltersChange} />
      </div>
    </PageLayout>
  );
};

export default ThemesPage;
