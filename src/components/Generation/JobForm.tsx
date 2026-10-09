import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/Common/MultiSelect";
import { SeriesSelector } from "@/components/Story/SeriesSelector";
import { AGE_GROUPS } from "@/types/Story";
import { Series } from "@/types/Series";
import { WeeklyTheme } from "@/types/Theme";
import { ALL_WEEK, GENERATION_DAYS_FR } from "@/constants";
import { mapFrToEnDay } from "@/utils/dayUtils";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useGenerationJobMutations } from "@/hooks/useGenerationJobs";
import { generationJobsApi } from "@/api/generationJobs.api";
import client from "@/api/client";
import { GenerationJobInput, JobPrefill } from "@/types/generation.types";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** "1 h 05 min" style duration. */
const formatDuration = (seconds: number) => {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

interface JobFormProps {
  weeklyThemes: WeeklyTheme[];
  series: Series[];
  /** Cells chosen in the coverage grid */
  prefill: JobPrefill | null;
  onCreated: (jobId: string) => void;
}

/**
 * JobForm Component
 *
 * Parameters of a mass generation job (weeks x ages, day or whole week, characters, series, provider),
 * with the estimate of what it will cost before launching it on the server.
 */
export const JobForm = ({ weeklyThemes, series, prefill, onCreated }: JobFormProps) => {
  const { t } = i18n;
  const [weeks, setWeeks] = useState<string[]>([]);
  const [ages, setAges] = useState<string[]>(["4-6"]);
  const [day, setDay] = useState(ALL_WEEK);
  const [numCharacters, setNumCharacters] = useState("");
  const [charNames, setCharNames] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [provider, setProvider] = useState<"gemini" | "local">("gemini");
  const [providerTouched, setProviderTouched] = useState(false);
  const [model, setModel] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const { create } = useGenerationJobMutations();

  // Default provider of Settings > AI generation, until the user picks one here
  const { data: appSettings } = useAppSettings();
  const settingsProvider = appSettings?.effective.defaultProvider;
  useEffect(() => {
    if (settingsProvider && !providerTouched) setProvider(settingsProvider);
  }, [settingsProvider, providerTouched]);

  useEffect(() => {
    if (!prefill) return;
    setWeeks(prefill.weeks.map(String));
    setAges(prefill.ages);
    setDay(ALL_WEEK);
  }, [prefill]);

  const { data: localModels = [] } = useQuery({
    queryKey: ["ollama-models"],
    queryFn: async () => (await client.get<{ models: string[] }>("/api/generate/ollama/models")).models || [],
    enabled: provider === "local",
    retry: false,
    staleTime: 60000,
  });

  const input: GenerationJobInput = useMemo(() => ({
    weeks: weeks.map(Number),
    ages,
    day,
    numCharacters: numCharacters ? Number(numCharacters) : null,
    charNames,
    seriesName,
    provider,
    model: provider === "local" ? model || null : null,
    skipExisting,
  }), [weeks, ages, day, numCharacters, charNames, seriesName, provider, model, skipExisting]);

  const ready = input.weeks.length > 0 && input.ages.length > 0;
  // Only what changes the plan is part of the key
  const { data: estimate, isFetching: estimating } = useQuery({
    queryKey: ["generation-estimate", input.weeks, input.ages, input.day, input.provider, input.skipExisting],
    queryFn: () => generationJobsApi.estimate(input),
    enabled: ready,
    staleTime: 10000,
  });

  const handleLaunch = () =>
    create.mutate(input, {
      onSuccess: (job) => {
        toast.success(t("generation.form.launched"));
        onCreated(job.id);
      },
      onError: (error) => toast.error((error as Error).message),
    });

  const multiSelectLabels = {
    selectedLabel: (count: number) => t("create.generate.selectedCount", { count: String(count) }),
    selectAllLabel: t("create.generate.selectAll"),
    clearLabel: t("create.generate.clearSelection"),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="job-weeks">{t("create.generate.projectWeek")}</Label>
          <MultiSelect
            id="job-weeks"
            options={weeklyThemes.map((wt) => ({
              value: String(wt.week_number),
              label: `${t("timeline.weekNumber", { number: wt.week_number })} - ${wt.theme_name}`,
            }))}
            value={weeks}
            onChange={setWeeks}
            placeholder={t("create.generate.selectWeeks")}
            {...multiSelectLabels}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-ages">{t("create.generate.age")}</Label>
          <MultiSelect
            id="job-ages"
            options={AGE_GROUPS.map((age) => ({ value: age, label: t(`ages.${age}`) }))}
            value={ages}
            onChange={setAges}
            placeholder={t("create.generate.selectAges")}
            {...multiSelectLabels}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-day">{t("create.generate.day")}</Label>
          {/* Values are the French day names expected by the prompt; labels follow the UI language */}
          <select id="job-day" className={selectClass} value={day} onChange={(e) => setDay(e.target.value)}>
            <option value={ALL_WEEK}>{t("create.generate.allWeek")}</option>
            {GENERATION_DAYS_FR.map((d) => (
              <option key={d} value={d}>{t(`days.${mapFrToEnDay(d).toLowerCase()}`)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-provider">{t("create.generate.aiProvider")}</Label>
          <select
            id="job-provider"
            className={selectClass}
            value={provider}
            onChange={(e) => { setProvider(e.target.value as "gemini" | "local"); setProviderTouched(true); }}
          >
            <option value="gemini">{t("create.generate.provider.gemini")}</option>
            <option value="local">{t("create.generate.provider.local")}</option>
          </select>
        </div>

        {provider === "local" ? (
          <div className="space-y-2">
            <Label htmlFor="job-model">{t("create.generate.aiModel")}</Label>
            <select id="job-model" className={selectClass} value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">{t("create.generate.model.default")}</option>
              {localModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ) : <div className="hidden md:block" />}

        <div className="space-y-2">
          <Label htmlFor="job-num-chars">{t("create.generate.numCharacters")}</Label>
          <Input id="job-num-chars" type="number" min="1" max="10" value={numCharacters} onChange={(e) => setNumCharacters(e.target.value)}
            placeholder={t("create.generate.numCharactersPlaceholder")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-char-names">{t("create.generate.charNames")}</Label>
          <Input id="job-char-names" value={charNames} onChange={(e) => setCharNames(e.target.value)}
            placeholder={t("create.generate.charNamesPlaceholder")} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>{t("story.series")}</Label>
          <SeriesSelector series={series} value={seriesName} onChange={setSeriesName} />
        </div>

        <div className="flex items-start gap-2 md:col-span-2">
          <Checkbox id="job-skip" checked={skipExisting} onCheckedChange={(checked) => setSkipExisting(checked === true)} />
          <div className="space-y-0.5">
            <Label htmlFor="job-skip">{t("generation.form.skipExisting")}</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("generation.form.skipExistingHint")}</p>
          </div>
        </div>
      </div>

      {/* Estimate */}
      {ready && (
        <div className="rounded-lg border bg-white/50 p-3 text-sm dark:bg-slate-800/50" aria-live="polite">
          {estimating && !estimate ? (
            <span className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {t("generation.form.estimating")}</span>
          ) : estimate && (
            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                {t("generation.form.estimate", {
                  units: String(estimate.toGenerate),
                  requests: String(estimate.requests),
                  duration: formatDuration(estimate.estimatedSeconds),
                })}
              </p>
              {estimate.skipped > 0 && (
                <p className="text-gray-500 dark:text-gray-400">{t("generation.form.skippedCells", { count: String(estimate.skipped) })}</p>
              )}
              {estimate.missingTopics.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {t("generation.form.missingTopics", { weeks: estimate.missingTopics.join(", ") })}
                </p>
              )}
              {estimate.quotaWarning && (
                <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t("generation.form.quotaWarning")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        onClick={handleLaunch}
        disabled={!ready || create.isPending || estimate?.toGenerate === 0}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
      >
        {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
        {t("generation.form.launch")}
      </Button>
    </div>
  );
};
