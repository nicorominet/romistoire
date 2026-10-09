import { useState } from "react";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useCoverage } from "@/hooks/useGenerationJobs";
import { JobPrefill } from "@/types/generation.types";
import { TopicSuggestionDialog } from "./TopicSuggestionDialog";

/** A week is complete with one story per day. */
const FULL_WEEK = 7;

const cellKey = (week: number, age: string) => `${week}:${age}`;

/** Color of a cell from the number of days written. */
const cellClass = (days: number, hasTopic: boolean) => {
  if (!hasTopic) return "bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500";
  if (days >= FULL_WEEK) return "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-200";
  if (days > 0) return "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200";
  return "bg-white text-gray-400 dark:bg-slate-900 dark:text-slate-500";
};

interface CoverageGridProps {
  /** Opens the job form pre-filled with the selected cells */
  onGenerate: (prefill: JobPrefill) => void;
}

/**
 * CoverageGrid Component
 *
 * Weeks x ages grid of the program: days written per cell (green = complete week, amber = partial,
 * white = empty, grey = no topic). Selected cells become a generation job; weeks without topic can
 * get AI topic proposals.
 */
export const CoverageGrid = ({ onGenerate }: CoverageGridProps) => {
  const { t } = i18n;
  const { data, isLoading, isError } = useCoverage();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestWeeks, setSuggestWeeks] = useState<number[] | null>(null);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (isError || !data) return <p className="p-4 text-red-600 dark:text-red-400">{t("generation.coverage.error")}</p>;

  const { weeks, ages, cells } = data;
  const days = (week: number, age: string) => cells[cellKey(week, age)]?.days ?? 0;
  const weeksWithoutTopic = weeks.filter((w) => !w.topic).map((w) => w.weekNumber);
  const hasTopic = new Map(weeks.map((w) => [w.weekNumber, Boolean(w.topic)]));
  // Selectable: a topic and an incomplete week
  const selectable = (week: number, age: string) => Boolean(hasTopic.get(week)) && days(week, age) < FULL_WEEK;

  const toggle = (keys: string[]) => {
    const next = new Set(selected);
    const allIn = keys.every((k) => next.has(k));
    keys.forEach((k) => (allIn ? next.delete(k) : next.add(k)));
    setSelected(next);
  };
  const toggleCell = (week: number, age: string) => selectable(week, age) && toggle([cellKey(week, age)]);
  const toggleRow = (week: number) => toggle(ages.filter((age) => selectable(week, age)).map((age) => cellKey(week, age)));
  const toggleColumn = (age: string) => toggle(weeks.filter((w) => selectable(w.weekNumber, age)).map((w) => cellKey(w.weekNumber, age)));

  const handleGenerate = () => {
    const chosen = [...selected].map((key) => key.split(":"));
    onGenerate({
      weeks: [...new Set(chosen.map(([week]) => Number(week)))].sort((a, b) => a - b),
      // Every chosen age for every chosen week: cells already complete are skipped by the job
      ages: ages.filter((age) => chosen.some(([, a]) => a === age)),
    });
  };

  const complete = weeks.reduce((total, w) => total + ages.filter((age) => days(w.weekNumber, age) >= FULL_WEEK).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("generation.coverage.summary", { complete: String(complete), total: String(weeks.length * ages.length) })}
        </p>
        <div className="flex flex-wrap gap-2">
          {weeksWithoutTopic.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setSuggestWeeks(weeksWithoutTopic)}>
              <Sparkles className="h-4 w-4" /> {t("generation.coverage.suggestTopics", { count: String(weeksWithoutTopic.length) })}
            </Button>
          )}
          {selected.size > 0 && (
            <>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4" /> {t("create.generate.clearSelection")}
              </Button>
              <Button size="sm" className="gap-1" onClick={handleGenerate}>
                <Wand2 className="h-4 w-4" /> {t("generation.coverage.generateSelection", { count: String(selected.size) })}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-200 dark:bg-green-900/60" /> {t("generation.coverage.legendComplete")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-900/60" /> {t("generation.coverage.legendPartial")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-white dark:bg-slate-900" /> {t("generation.coverage.legendEmpty")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-100 dark:bg-slate-800" /> {t("generation.coverage.legendNoTopic")}</span>
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
            <tr>
              <th className="p-2 text-left font-medium">{t("generation.detail.week")}</th>
              {ages.map((age) => (
                <th key={age} className="p-1 text-center font-medium">
                  <button type="button" onClick={() => toggleColumn(age)} className="rounded px-1 hover:underline" title={t("generation.coverage.selectColumn")}>
                    {t(`ages.${age}`)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map(({ weekNumber, topic }) => (
              <tr key={weekNumber} className="border-t">
                <th scope="row" className="max-w-[220px] p-1 text-left font-normal">
                  <button type="button" onClick={() => toggleRow(weekNumber)} className="w-full truncate rounded px-1 text-left hover:underline" title={topic || t("generation.coverage.noTopic")}>
                    <span className="font-medium">{weekNumber}</span>
                    <span className={`ml-2 ${topic ? "text-gray-600 dark:text-gray-400" : "italic text-gray-400"}`}>{topic || t("generation.coverage.noTopic")}</span>
                  </button>
                </th>
                {ages.map((age) => {
                  const key = cellKey(weekNumber, age);
                  const count = days(weekNumber, age);
                  const isSelected = selected.has(key);
                  return (
                    <td key={age} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => toggleCell(weekNumber, age)}
                        disabled={!selectable(weekNumber, age)}
                        aria-pressed={isSelected}
                        aria-label={t("generation.coverage.cellLabel", { week: String(weekNumber), age: t(`ages.${age}`), days: String(count) })}
                        className={`h-8 w-full rounded text-xs font-medium ${cellClass(count, Boolean(topic))} ${isSelected ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900" : ""} disabled:cursor-default`}
                      >
                        {count > 0 ? `${count}/${FULL_WEEK}` : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TopicSuggestionDialog weeks={suggestWeeks} onClose={() => setSuggestWeeks(null)} />
    </div>
  );
};
