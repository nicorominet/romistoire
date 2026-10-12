import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileJson, Image, ImagePlus, Loader2, MoreHorizontal, RefreshCw, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { AgeGroup } from "@/types/Story";
import { Series } from "@/types/Series";
import { Theme, WeeklyTheme } from "@/types/Theme";
import StoriesSearch from "@/components/Story/StoriesList/StoriesSearch";
import { useThemes, useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { IllustrationFilters, IllustrationTodo, illustrationApi } from "@/api/illustrations.api";
import { shrinkImage } from "@/utils/illustrationImport";
import { IllustrationTodoRow } from "@/components/Illustrations/IllustrationTodoRow";
import { IllustrationImportDialog } from "@/components/Illustrations/IllustrationImportDialog";
import { CanvasToolDialog } from "@/components/Illustrations/CanvasToolDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Flash Lite allows 15 requests per minute: one prompt every 5 s stays below. */
const BATCH_PACE_MS = 5000;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Illustration workshop: stories without image, their ready-to-paste prompts, and the ways to bring the images
 * back (paste on a row, batch import by code or order, Gemini Canvas tool). The API image models have no free quota.
 */
const IllustrationsPage = () => {
  const { t } = i18n;
  const queryClient = useQueryClient();
  // Same filters as the stories page, kept in the URL; the workshop shows the stories without image by default
  const [searchParams, setSearchParams] = useSearchParams();
  const param = (key: string) => searchParams.get(key) || "all";
  const setFilter = useCallback((key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const isDefault = key === "hasImage" ? value === "no" : !value || value === "all";
      if (isDefault) next.delete(key);
      else next.set(key, value as string);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const weekParam = parseInt(searchParams.get("weekNumber") || "", 10);
  const weekNumber = Number.isNaN(weekParam) ? null : weekParam;
  const hasImage = searchParams.get("hasImage") || "no";
  const search = searchParams.get("search") || "";
  const [searchTerm, setSearchTerm] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== search) setFilter("search", searchTerm.trim() || null);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, search, setFilter]);

  const filters: IllustrationFilters = {
    theme: param("theme"), ageGroup: param("ageGroup"), weekNumber: weekNumber ?? undefined, dayOfWeek: param("dayOfWeek"),
    hasImage, hasAudio: param("hasAudio"), seriesId: param("seriesId"), source: param("source"),
    editStatus: param("editStatus"), reviewStatus: param("reviewStatus"), search,
    generationJobId: searchParams.get("generationJobId") || undefined,
  };
  const queryKey = ["illustrations", filters];

  const { data: themesData } = useThemes();
  const { data: weeklyThemesData } = useWeeklyThemes();
  const { data: seriesData } = useSeries();
  const weeklyThemesMap = useMemo(() => {
    const map: { [week: number]: string } = {};
    ((weeklyThemesData as WeeklyTheme[]) || []).forEach(wt => { map[wt.week_number] = wt.theme_name; });
    return map;
  }, [weeklyThemesData]);

  const { data: items = [], isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => illustrationApi.getTodo(filters),
  });

  // Images attached during this session: rows stay in place (no jumping list) and show the new image
  const [attached, setAttached] = useState<Map<string, string>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const stopBatch = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const missingPrompts = items.filter(item => !item.illustration_prompt);
  const illustratedCount = items.filter(item => item.illustrationCount > 0).length;

  const updateItem = (id: string, changes: Partial<IllustrationTodo>) =>
    queryClient.setQueryData<IllustrationTodo[]>(queryKey, current => current?.map(item => (item.id === id ? { ...item, ...changes } : item)));

  const setGenerating = (id: string, on: boolean) => setGeneratingIds(current => {
    const next = new Set(current);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  /** @returns false when the AI failed. */
  const generatePrompt = async (item: IllustrationTodo) => {
    setGenerating(item.id, true);
    try {
      const result = await illustrationApi.generatePrompt(item.id);
      updateItem(item.id, { illustration_prompt: result.illustration_prompt, imagePrompt: result.imagePrompt });
      return true;
    } catch (error) {
      toast.error(t("illustrations.promptError"), { description: getApiError(error).message });
      return false;
    } finally {
      setGenerating(item.id, false);
    }
  };

  const generateMissing = async () => {
    const todo = [...missingPrompts];
    stopBatch.current = false;
    setBatch({ done: 0, total: todo.length });
    for (let index = 0; index < todo.length && !stopBatch.current; index++) {
      if (index > 0) await wait(BATCH_PACE_MS);
      if (stopBatch.current) break;
      const ok = await generatePrompt(todo[index]);
      if (!ok) break;
      setBatch({ done: index + 1, total: todo.length });
    }
    setBatch(null);
  };

  const savePrompt = async (item: IllustrationTodo, prompt: string) => {
    try {
      const result = await illustrationApi.setPrompt(item.id, prompt);
      updateItem(item.id, { illustration_prompt: result.illustration_prompt, imagePrompt: result.imagePrompt });
      toast.success(t("illustrations.promptSaved"));
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  const attach = async (item: IllustrationTodo, file: File) => {
    try {
      const image = await shrinkImage(file);
      const alreadyAttached = attached.has(item.id) ? 1 : 0;
      await illustrationApi.attach(item.id, image, item.illustrationCount + alreadyAttached);
      setAttached(current => new Map(current).set(item.id, URL.createObjectURL(image)));
      queryClient.invalidateQueries({ queryKey: ["story", item.id] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success(t("illustrations.attached", { title: item.title }));
    } catch (error) {
      toast.error(t("create.error.failedToUploadImage"), { description: getApiError(error).message });
      throw error;
    }
  };

  const exportPrompts = async (format: "txt" | "json") => {
    try {
      const blob = await illustrationApi.exportPrompts(filters, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prompts-illustrations-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  const refresh = () => {
    setAttached(new Map());
    refetch();
  };

  return (
    <PageLayout>
      <div className="space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">{t("illustrations.title")}</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">{t("illustrations.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {batch ? (
              <Button type="button" variant="destructive" onClick={() => { stopBatch.current = true; }}>
                <Square className="mr-2 h-4 w-4" />
                {t("illustrations.stopBatch", { done: batch.done, total: batch.total })}
              </Button>
            ) : (
              <Button type="button" onClick={generateMissing} disabled={missingPrompts.length === 0 || generatingIds.size > 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("illustrations.createMissing", { count: missingPrompts.length })}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)} disabled={items.length === 0}>
              <ImagePlus className="mr-2 h-4 w-4" />
              {t("illustrations.importImages")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCanvasOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" />
              {t("illustrations.canvas.button")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={t("illustrations.moreActions")} title={t("illustrations.moreActions")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportPrompts("txt")} disabled={items.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("illustrations.exportTxt")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportPrompts("json")} disabled={items.length === 0}>
                  <FileJson className="mr-2 h-4 w-4" />
                  {t("illustrations.exportJson")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={refresh} disabled={isFetching}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  {t("illustrations.refresh")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label={t("illustrations.overview")}>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("illustrations.storiesShown")}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? "—" : items.length}</p>
          </div>
          <div className="rounded-xl border border-story-purple-200 bg-story-purple-50/70 p-4 dark:border-story-purple-800 dark:bg-story-purple-950/30">
            <p className="text-sm text-muted-foreground">{t("illustrations.promptsToCreate")}</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-story-purple-800 dark:text-story-purple-200">
              <Sparkles className="h-5 w-5" />{isLoading ? "—" : missingPrompts.length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("illustrations.storiesWithImages")}</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <Image className="h-5 w-5 text-green-600" />{isLoading ? "—" : illustratedCount}
            </p>
          </div>
        </section>

        <StoriesSearch
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          handleSearch={() => setFilter("search", searchTerm.trim() || null)}
          selectedTheme={param("theme")}
          handleThemeChange={value => setFilter("theme", value)}
          themes={(themesData as Theme[]) || []}
          weeklyThemesMap={weeklyThemesMap}
          selectedAgeGroup={param("ageGroup") as AgeGroup | "all"}
          handleAgeGroupChange={value => setFilter("ageGroup", value)}
          selectedWeekNumber={weekNumber}
          handleWeekNumberChange={value => setFilter("weekNumber", value === null ? null : String(value))}
          selectedDayOfWeek={param("dayOfWeek")}
          handleDayOfWeekChange={value => setFilter("dayOfWeek", value)}
          hasImage={hasImage}
          handleHasImageChange={value => setFilter("hasImage", value)}
          hasAudio={param("hasAudio")}
          handleHasAudioChange={value => setFilter("hasAudio", value)}
          series={(seriesData as Series[]) || []}
          selectedSeries={param("seriesId")}
          handleSeriesChange={value => setFilter("seriesId", value)}
          selectedSource={param("source")}
          handleSourceChange={value => setFilter("source", value)}
          selectedEditStatus={param("editStatus")}
          handleEditStatusChange={value => setFilter("editStatus", value)}
          selectedReviewStatus={param("reviewStatus")}
          handleReviewStatusChange={value => setFilter("reviewStatus", value)}
          handleResetFilters={() => {
            // Back to the default view of the workshop: every story without image
            setSearchTerm("");
            setSearchParams({}, { replace: true });
          }}
        />

        {batch && (
          <div className="space-y-2 rounded-lg border bg-card p-4" role="status">
            <div className="flex justify-between text-sm">
              <span>{t("illustrations.createMissing", { count: batch.total })}</span>
              <span>{batch.done}/{batch.total}</span>
            </div>
            <Progress value={(batch.done / Math.max(batch.total, 1)) * 100} />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {hasImage === "no" ? t("illustrations.allDone") : t("illustrations.empty")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("illustrations.count", { count: items.length, done: attached.size })}</p>
            <ul className="space-y-3">
              {items.map(item => (
                <IllustrationTodoRow
                  key={item.id}
                  item={item}
                  attachedImage={attached.get(item.id)}
                  generating={generatingIds.has(item.id)}
                  onGeneratePrompt={generatePrompt}
                  onSavePrompt={savePrompt}
                  onAttach={attach}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <IllustrationImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        stories={items}
        attachedIds={new Set(attached.keys())}
        onAttach={attach}
      />
      <CanvasToolDialog open={canvasOpen} onOpenChange={setCanvasOpen} />
    </PageLayout>
  );
};

export default IllustrationsPage;
