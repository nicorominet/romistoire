import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { APP_ROUTES } from "@/constants";
import { useThemeMutations, useThemes, useWeeklyThemeMutations, useWeeklyThemes } from "@/hooks/useThemes";
import { currentIsoWeek, dateLocale, formatWeekRange, weekMonth, weeksInIsoYear } from "@/utils/weekUtils";
import { safeThemeColor } from "@/utils/themeColors";
import { Theme } from "@/types/Theme";
import { ThemeSelect } from "./ThemeSelect";

interface WeeklyThemeCalendarProps {
  year: number;
  onYearChange: (year: number) => void;
}

/**
 * Calendar tab: every ISO week of the year grouped by month, current week highlighted.
 * Picking a theme saves the week at once (no global "save all").
 */
export const WeeklyThemeCalendar = ({ year, onYearChange }: WeeklyThemeCalendarProps) => {
  const { t } = i18n;
  const locale = i18n.getCurrentLocale();
  const { data: themes = [] } = useThemes();
  const { data: weeks = [] } = useWeeklyThemes();
  const { setWeekTheme, clearWeekTheme } = useWeeklyThemeMutations();
  const { createTheme } = useThemeMutations();
  const current = currentIsoWeek();
  const currentRef = useRef<HTMLLIElement>(null);

  const weekCount = Math.max(weeksInIsoYear(year), ...weeks.map(week => week.week_number));
  const byWeek = useMemo(() => new Map(weeks.map(week => [week.week_number, week])), [weeks]);
  const configured = weeks.filter(week => week.week_number <= weekCount).length;

  const months = useMemo(() => {
    const groups = new Map<number, number[]>();
    for (let week = 1; week <= weekCount; week++) {
      const month = weekMonth(week, year);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(week);
    }
    return [...groups.entries()];
  }, [weekCount, year]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [year]);

  const monthName = (month: number) =>
    new Intl.DateTimeFormat(dateLocale(locale).code, { month: "long" }).format(new Date(year, month, 1));

  const saveWeek = async (weekNumber: number, themeId: string | null) => {
    try {
      if (themeId) await setWeekTheme.mutateAsync({ weekNumber, themeId });
      else await clearWeekTheme.mutateAsync(weekNumber);
      toast.success(t("weeklyThemes.saved", { week: String(weekNumber) }), { duration: 1500 });
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const createAndAssign = async (weekNumber: number, name: string): Promise<Theme | void> => {
    try {
      const theme = await createTheme.mutateAsync({ name });
      await saveWeek(weekNumber, theme.id);
      return theme;
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onYearChange(year - 1)} aria-label={t("weeklyThemes.previousYear")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-16 text-center text-lg font-semibold tabular-nums">{year}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onYearChange(year + 1)} aria-label={t("weeklyThemes.nextYear")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {year !== current.year && (
            <Button type="button" variant="link" size="sm" onClick={() => onYearChange(current.year)}>{t("weeklyThemes.thisYear")}</Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("weeklyThemes.progress", { done: String(configured), total: String(weekCount) })}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t("weeklyThemes.hint")}</p>

      <div className="space-y-6">
        {months.map(([month, monthWeeks]) => (
          <section key={month} aria-labelledby={`month-${month}`}>
            <h3 id={`month-${month}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{monthName(month)}</h3>
            <ul className="space-y-2">
              {monthWeeks.map(weekNumber => {
                const week = byWeek.get(weekNumber);
                const isCurrent = year === current.year && weekNumber === current.week;
                return (
                  <li key={weekNumber} ref={isCurrent ? currentRef : undefined}
                    className={cn("grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3 sm:grid-cols-[7rem_1fr_auto]",
                      isCurrent && "border-primary ring-1 ring-primary")}
                    style={week?.color ? { borderLeftWidth: 4, borderLeftColor: safeThemeColor(week.color) } : undefined}>
                    <div>
                      <p className="font-medium tabular-nums">
                        {t("timeline.weekNumber", { number: weekNumber })}
                        {isCurrent && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] uppercase text-primary-foreground">{t("weeklyThemes.current")}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatWeekRange(weekNumber, year, locale)}</p>
                    </div>
                    <ThemeSelect
                      themes={themes}
                      value={week?.theme_id ?? null}
                      onChange={(themeId) => saveWeek(weekNumber, themeId)}
                      onCreate={(name) => createAndAssign(weekNumber, name)}
                      placeholder={week?.theme_name && !week.theme_id ? week.theme_name : t("weeklyThemes.chooseTheme")}
                      showCounts
                      className="col-span-2 sm:col-span-1"
                    />
                    <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link to={`${APP_ROUTES.STORIES}?weekNumber=${weekNumber}`} aria-label={t("weeklyThemes.weekStories", { week: String(weekNumber) })}>
                          <BookOpen className="h-4 w-4" />
                        </Link>
                      </Button>
                      {week && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => saveWeek(weekNumber, null)}
                          aria-label={t("weeklyThemes.clearWeek", { week: String(weekNumber) })}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default WeeklyThemeCalendar;
