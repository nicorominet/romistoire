import { useEffect, useMemo, useRef, useState } from "react";
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
  const currentRef = useRef<HTMLLIElement>(null);

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

  useEffect(() => {
    if (!isLoading) currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [year, isLoading]);

  const monthName = (month: number) =>
    new Intl.DateTimeFormat(dateLocale(locale).code, { month: "long" }).format(new Date(year, month, 1));

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
        <p className="text-sm text-muted-foreground">{t("weeklyTopics.progress", { done: String(configured), total: String(weekCount) })}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t("weeklyTopics.hint")}</p>

      {invalidWeeks.length > 0 && <InvalidWeeks weeks={invalidWeeks} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {months.map(([month, monthWeeks]) => (
            <section key={month} aria-labelledby={`month-${month}`}>
              <h2 id={`month-${month}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{monthName(month)}</h2>
              <ul className="space-y-2">
                {monthWeeks.map(weekNumber => {
                  const isCurrent = year === current.year && weekNumber === current.week;
                  return (
                    <WeeklyTopicRow
                      key={`${year}-${weekNumber}`}
                      ref={isCurrent ? currentRef : undefined}
                      weekNumber={weekNumber}
                      rangeLabel={formatWeekRange(weekNumber, year, locale)}
                      week={byWeek.get(weekNumber)}
                      isCurrent={isCurrent}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
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

export default WeeklyTopicCalendar;
