import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { useWeeklyThemeMutations, useWeeklyThemes } from "@/hooks/useThemes";
import { currentIsoWeek, dateLocale, formatWeekRange, MAX_ISO_WEEKS, weekMonth, weeksInIsoYear } from "@/utils/weekUtils";
import { WeeklyTheme } from "@/types/Theme";
import { WeeklyTopicRow } from "./WeeklyTopicRow";

interface WeeklyTopicCalendarProps {
  year: number;
  onYearChange: (year: number) => void;
}

/**
 * Weekly program: the ISO weeks of the year (52 or 53) grouped by month, current week highlighted.
 * Weeks numbered beyond 53 (legacy data) are listed apart, to be removed.
 */
export const WeeklyTopicCalendar = ({ year, onYearChange }: WeeklyTopicCalendarProps) => {
  const { t } = i18n;
  const locale = i18n.getCurrentLocale();
  const { data: weeks = [], isLoading } = useWeeklyThemes();
  const current = currentIsoWeek();
  const [view, setView] = useState<"all" | "configured" | "empty">("all");
  const [selectedMonth, setSelectedMonth] = useState(() => (
    year === current.year ? weekMonth(current.week, current.year) : weekMonth(1, year)
  ));

  const weekCount = weeksInIsoYear(year);
  const byWeek = useMemo(() => new Map((weeks as WeeklyTheme[]).map(week => [week.week_number, week])), [weeks]);
  const configured = (weeks as WeeklyTheme[]).filter(week => week.week_number <= weekCount && week.theme_name?.trim()).length;
  const invalidWeeks = (weeks as WeeklyTheme[]).filter(week => week.week_number > MAX_ISO_WEEKS);

  const months = useMemo(() => {
    const groups = new Map<number, number[]>();
    for (let week = 1; week <= weekCount; week++) {
      const month = weekMonth(week, year);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(week);
    }
    return [...groups.entries()];
  }, [weekCount, year]);

  const monthName = (month: number) =>
    new Intl.DateTimeFormat(dateLocale(locale).code, { month: "long" }).format(new Date(year, month, 1));
  const monthIndex = months.findIndex(([month]) => month === selectedMonth);
  const selectedWeeks = months[monthIndex]?.[1] ?? [];
  const selectedConfigured = selectedWeeks.filter(week => byWeek.get(week)?.theme_name?.trim()).length;
  const visibleWeeks = selectedWeeks.filter(weekNumber => {
    const hasTopic = Boolean(byWeek.get(weekNumber)?.theme_name?.trim());
    return view === "all" || (view === "configured" ? hasTopic : !hasTopic);
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-label={t("weeklyTopics.yearOverview")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
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
          <div className="min-w-52 flex-1 sm:max-w-sm">
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="font-medium">{t("weeklyTopics.progress", { done: String(configured), total: String(weekCount) })}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round((configured / weekCount) * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={t("weeklyTopics.progress", { done: String(configured), total: String(weekCount) })}
              aria-valuemin={0}
              aria-valuemax={weekCount}
              aria-valuenow={configured}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(configured / weekCount) * 100}%` }} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("weeklyTopics.hint")}</p>
      </section>

      {invalidWeeks.length > 0 && <InvalidWeeks weeks={invalidWeeks} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("weeklyTopics.weekFilters")}>
              {(["all", "configured", "empty"] as const).map(filter => {
                const count = filter === "all" ? selectedWeeks.length : filter === "configured" ? selectedConfigured : selectedWeeks.length - selectedConfigured;
                return (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={view === filter ? "default" : "outline"}
                    aria-pressed={view === filter}
                    onClick={() => setView(filter)}
                  >
                    {t(`weeklyTopics.view.${filter}`, { count: String(count) })}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2" role="group" aria-label={t("weeklyTopics.monthNavigation")}>
              <Button type="button" variant="outline" size="icon" disabled={monthIndex <= 0}
                onClick={() => setSelectedMonth(months[monthIndex - 1][0])} aria-label={t("weeklyTopics.previousMonth")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <select
                value={String(selectedMonth)}
                onChange={event => setSelectedMonth(Number(event.target.value))}
                aria-label={t("weeklyTopics.monthNavigation")}
                className="h-10 min-w-40 rounded-md border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {months.map(([month, monthWeeks]) => {
                  const monthConfigured = monthWeeks.filter(week => byWeek.get(week)?.theme_name?.trim()).length;
                  return (
                    <option key={month} value={String(month)}>
                      {monthName(month)} · {monthConfigured}/{monthWeeks.length}
                    </option>
                  );
                })}
              </select>
              <Button type="button" variant="outline" size="icon" disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                onClick={() => setSelectedMonth(months[monthIndex + 1][0])} aria-label={t("weeklyTopics.nextMonth")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("weeklyTopics.monthProgress", { done: String(selectedConfigured), total: String(selectedWeeks.length) })}
              </span>
            </div>
          </div>
          <section aria-labelledby={`month-${year}-${selectedMonth}-heading`}>
            <h2 id={`month-${year}-${selectedMonth}-heading`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthName(selectedMonth)}
            </h2>
            {visibleWeeks.length > 0 ? (
              <ul className="space-y-2">
                {visibleWeeks.map(weekNumber => (
                  <WeeklyTopicRow
                    key={`${year}-${weekNumber}`}
                    weekNumber={weekNumber}
                    rangeLabel={formatWeekRange(weekNumber, year, locale)}
                    week={byWeek.get(weekNumber)}
                    isCurrent={year === current.year && weekNumber === current.week}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("weeklyTopics.noWeeksForFilter")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

/** Legacy weeks numbered beyond 53: never shown in the calendar, removable one by one or all at once. */
const InvalidWeeks = ({ weeks }: { weeks: WeeklyTheme[] }) => {
  const { t } = i18n;
  const { clearWeekTheme } = useWeeklyThemeMutations();
  const [removing, setRemoving] = useState(false);

  const remove = async (weekNumbers: number[]) => {
    setRemoving(true);
    try {
      for (const weekNumber of weekNumbers) await clearWeekTheme.mutateAsync(weekNumber);
      toast.success(t("weeklyTopics.invalidRemoved", { count: String(weekNumbers.length) }));
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <details className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {t("weeklyTopics.invalidWeeks", { count: String(weeks.length) })}
      </summary>
      <p className="mt-2 text-muted-foreground">{t("weeklyTopics.invalidWeeksHint")}</p>
      <ul className="mt-2 space-y-1">
        {weeks.map(week => (
          <li key={week.week_number} className="flex items-center justify-between gap-2">
            <span>
              <span className="tabular-nums">{t("timeline.weekNumber", { number: week.week_number })}</span>
              <span className="text-muted-foreground"> — {week.theme_name}</span>
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={removing} onClick={() => remove([week.week_number])}
              aria-label={t("weeklyThemes.clearWeek", { week: String(week.week_number) })}>
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={removing}
        onClick={() => remove(weeks.map(week => week.week_number))}>
        {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("weeklyTopics.removeAll")}
      </Button>
    </details>
  );
};
