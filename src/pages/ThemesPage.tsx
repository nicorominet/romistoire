import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Tags } from "lucide-react";
import PageLayout from "@/components/Layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { i18n } from "@/lib/i18n";
import { ThemeLibrary, ThemeLibraryFilters, ThemeQuickFilter } from "@/components/Theme/ThemeLibrary";
import { WeeklyThemeCalendar } from "@/components/Theme/WeeklyThemeCalendar";
import { currentIsoWeek } from "@/utils/weekUtils";
import { ThemeSort } from "@/types/Theme";

type ThemesTab = "themes" | "calendar";

const SORTS: ThemeSort[] = ["name", "usage", "recent"];
const QUICK_FILTERS: ThemeQuickFilter[] = ["all", "review", "unused"];

/**
 * Themes page: the theme library and the weekly calendar, as two tabs.
 * Tab, search, sort, quick filter and calendar year live in the URL.
 */
const ThemesPage = () => {
  const { t } = i18n;
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: ThemesTab = searchParams.get("tab") === "calendar" ? "calendar" : "themes";
  const sortParam = searchParams.get("sort") as ThemeSort;
  const filterParam = searchParams.get("filter") as ThemeQuickFilter;
  const filters: ThemeLibraryFilters = {
    search: searchParams.get("q") ?? "",
    sort: SORTS.includes(sortParam) ? sortParam : "name",
    filter: QUICK_FILTERS.includes(filterParam) ? filterParam : "all",
  };
  const year = Number(searchParams.get("year")) || currentIsoWeek().year;

  const setParams = useCallback((patch: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleFiltersChange = useCallback((patch: Partial<ThemeLibraryFilters>) => {
    setParams({
      ...(patch.search !== undefined ? { q: patch.search } : {}),
      ...(patch.sort !== undefined ? { sort: patch.sort === "name" ? null : patch.sort } : {}),
      ...(patch.filter !== undefined ? { filter: patch.filter === "all" ? null : patch.filter } : {}),
    });
  }, [setParams]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">{t("themes.pageTitle")}</h1>
          <p className="text-muted-foreground">{t("themes.pageSubtitle")}</p>
        </header>

        <Tabs value={tab} onValueChange={(value) => setParams({ tab: value === "themes" ? null : value })}>
          <TabsList>
            <TabsTrigger value="themes" className="gap-1.5"><Tags className="h-4 w-4" />{t("themes.tabs.themes")}</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" />{t("themes.tabs.calendar")}</TabsTrigger>
          </TabsList>
          <TabsContent value="themes" className="mt-4">
            <ThemeLibrary filters={filters} onFiltersChange={handleFiltersChange} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <WeeklyThemeCalendar year={year} onYearChange={(value) => setParams({ year: value === currentIsoWeek().year ? null : String(value) })} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default ThemesPage;
