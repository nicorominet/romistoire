import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Info, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/Common/MultiSelect";
import QuotaEstimate from "@/components/Generation/QuotaEstimate";
import { WeeklyTheme } from "@/types/Theme";
import { ALL_WEEK } from "@/constants";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useGenerationJobMutations } from "@/hooks/useGenerationJobs";
import { generationJobsApi } from "@/api/generationJobs.api";
import { currentIsoWeek, weekMonth } from "@/utils/weekUtils";
import { GenerationJobInput } from "@/types/generation.types";
import { Cast } from "@/types/framed.types";
import { selectClass } from "./CastEditor";

/** A week far behind the current one belongs to next year's program (same rule as the server, yearOfWeek). */
const BEHIND_WEEKS = 8;
const SEASONS: Record<string, number[]> = { winter: [11, 0, 1], spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10] };

/** Weeks of the program whose Thursday falls in one of `months`. */
const weeksOfMonths = (months: number[], themedWeeks: number[]) => {
  const now = currentIsoWeek();
  return themedWeeks.filter((week) => months.includes(weekMonth(week, week < now.week - BEHIND_WEEKS ? now.year + 1 : now.year)));
};

const formatDays = (days: number) => i18n.t(days > 1 ? "framed.launch.days" : "framed.launch.day", { count: String(days) });

interface FramedJobFormProps {
  cast: Cast;
  weeklyThemes: WeeklyTheme[];
  onCreated: (jobId: string) => void;
}

/**
 * FramedJobForm Component
 *
 * Launches a framed job: weeks (by month, season or year), the age groups of the cast, the audit of each week and
 * a daily budget of requests. A job short of quota waits for the next quota day by itself.
 */
export const FramedJobForm = ({ cast, weeklyThemes, onCreated }: FramedJobFormProps) => {
  const { t } = i18n;
  const [weeks, setWeeks] = useState<string[]>([]);
  const [ages, setAges] = useState<string[]>(cast.ageGroups);
  const [provider, setProvider] = useState<"gemini" | "local">("gemini");
  const [providerTouched, setProviderTouched] = useState(false);
  const [audit, setAudit] = useState(true);
  const [dailyBudget, setDailyBudget] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [flashOnly, setFlashOnly] = useState(false);
  const { create } = useGenerationJobMutations();

  useEffect(() => setAges(cast.ageGroups), [cast.id, cast.ageGroups]);

  const { data: appSettings } = useAppSettings();
  const settingsProvider = appSettings?.effective.defaultProvider;
  useEffect(() => {
    if (settingsProvider && !providerTouched) setProvider(settingsProvider);
  }, [settingsProvider, providerTouched]);

  const themedWeeks = useMemo(() => weeklyThemes.map((wt) => Number(wt.week_number)).sort((a, b) => a - b), [weeklyThemes]);
  const pick = (list: number[]) => setWeeks(list.map(String));

  const input: GenerationJobInput = useMemo(() => ({
    mode: "framed",
    castId: cast.id,
    weeks: weeks.map(Number),
    ages,
    day: ALL_WEEK,
    provider,
    skipExisting,
    audit,
    dailyBudget: dailyBudget ? Number(dailyBudget) : null,
    flashOnly: provider === "gemini" && flashOnly,
  }), [cast.id, weeks, ages, provider, skipExisting, audit, dailyBudget, flashOnly]);

  const ready = input.weeks.length > 0 && input.ages.length > 0;
  const { data: estimate, isFetching: estimating, error: estimateError } = useQuery({
    queryKey: ["generation-estimate", "framed", input],
    queryFn: () => generationJobsApi.estimate(input),
    enabled: ready,
    staleTime: 10000,
    retry: false,
  });

  const handleLaunch = () => create.mutate(input, {
    onSuccess: (job) => { toast.success(t("generation.form.launched")); onCreated(job.id); },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="framed-weeks">{t("create.generate.projectWeek")}</Label>
        <div className="flex flex-wrap gap-2">
          <select className={`${selectClass} w-auto`} aria-label={t("framed.launch.month")} value=""
            onChange={(e) => e.target.value !== "" && pick(weeksOfMonths([Number(e.target.value)], themedWeeks))}>
            <option value="">{t("framed.launch.month")}</option>
            {Array.from({ length: 12 }, (_, month) => (
              <option key={month} value={month}>{new Date(2026, month, 1).toLocaleString(i18n.getCurrentLocale() === "en" ? "en" : "fr", { month: "long" })}</option>
            ))}
          </select>
          <select className={`${selectClass} w-auto`} aria-label={t("framed.launch.season")} value=""
            onChange={(e) => e.target.value && pick(weeksOfMonths(SEASONS[e.target.value], themedWeeks))}>
            <option value="">{t("framed.launch.season")}</option>
            {Object.keys(SEASONS).map((season) => <option key={season} value={season}>{t(`framed.launch.seasons.${season}`)}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={() => pick(themedWeeks)}>{t("framed.launch.year")}</Button>
        </div>
        <MultiSelect
          id="framed-weeks"
          options={weeklyThemes.map((wt) => ({ value: String(wt.week_number), label: `${t("timeline.weekNumber", { number: wt.week_number })} - ${wt.theme_name}` }))}
          value={weeks}
          onChange={setWeeks}
          placeholder={t("create.generate.selectWeeks")}
          selectedLabel={(count: number) => t("create.generate.selectedCount", { count: String(count) })}
          selectAllLabel={t("create.generate.selectAll")}
          clearLabel={t("create.generate.clearSelection")}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("create.generate.age")}</legend>
        <div className="flex flex-wrap gap-4">
          {cast.ageGroups.map((age) => (
            <label key={age} className="flex items-center gap-2 text-sm">
              <Checkbox checked={ages.includes(age)}
                onCheckedChange={(checked) => setAges(checked === true ? [...ages, age] : ages.filter((a) => a !== age))} />
              {t(`ages.${age}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="framed-provider">{t("create.generate.aiProvider")}</Label>
          <select id="framed-provider" className={selectClass} value={provider}
            onChange={(e) => { setProvider(e.target.value as "gemini" | "local"); setProviderTouched(true); }}>
            <option value="gemini">{t("create.generate.provider.gemini")}</option>
            <option value="local">{t("create.generate.provider.local")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="framed-budget">{t("framed.launch.dailyBudget")}</Label>
          <Input id="framed-budget" type="number" min="1" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)}
            placeholder={t("framed.launch.dailyBudgetPlaceholder")} disabled={provider !== "gemini"} />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("framed.launch.dailyBudgetHint")}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox id="framed-audit" checked={audit} onCheckedChange={(checked) => setAudit(checked === true)} />
          <div className="space-y-0.5">
            <Label htmlFor="framed-audit">{t("framed.launch.audit")}</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("framed.launch.auditHint")}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="framed-skip" checked={skipExisting} onCheckedChange={(checked) => setSkipExisting(checked === true)} />
          <div className="space-y-0.5">
            <Label htmlFor="framed-skip">{t("generation.form.skipExisting")}</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("framed.launch.skipExistingHint")}</p>
          </div>
        </div>
        {provider === "gemini" && (
          <div className="flex items-start gap-2">
            <Checkbox id="framed-flash-only" checked={flashOnly} onCheckedChange={(checked) => setFlashOnly(checked === true)} />
            <div className="space-y-0.5">
              <Label htmlFor="framed-flash-only">{t("generation.quota.flashOnly")}</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("generation.quota.flashOnlyHint")}</p>
            </div>
          </div>
        )}
      </div>

      {ready && (
        <div className="rounded-lg border bg-white/50 p-3 text-sm dark:bg-slate-800/50" aria-live="polite">
          {estimating && !estimate ? (
            <span className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {t("generation.form.estimating")}</span>
          ) : estimateError ? (
            <p className="text-red-600 dark:text-red-400">{(estimateError as Error).message}</p>
          ) : estimate && (
            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                {t("framed.launch.estimate", { units: String(estimate.toGenerate), requests: String(estimate.requests) })}
              </p>
              {estimate.skipped > 0 && <p className="text-gray-500 dark:text-gray-400">{t("generation.form.skippedCells", { count: String(estimate.skipped) })}</p>}
              {estimate.missingTopics.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">{t("generation.form.missingTopics", { weeks: estimate.missingTopics.join(", ") })}</p>
              )}
              {estimate.schedule?.days != null && (
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-indigo-500" />
                  {estimate.schedule.days > 1
                    ? t("framed.launch.scheduleSpread", {
                      days: formatDays(estimate.schedule.days),
                      today: String(estimate.schedule.today ?? 0),
                      perDay: String(estimate.schedule.perDay ?? 0),
                    })
                    : t("framed.launch.scheduleToday")}
                </p>
              )}
              <QuotaEstimate estimate={estimate} flashOnly={Boolean(input.flashOnly)} />
            </div>
          )}
        </div>
      )}

      <Button type="button" onClick={handleLaunch} disabled={!ready || create.isPending || !estimate || estimate.toGenerate === 0}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
        {t("framed.launch.launch")}
      </Button>
    </div>
  );
};
