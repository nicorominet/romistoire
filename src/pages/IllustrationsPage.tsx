import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileJson, ImagePlus, Loader2, RefreshCw, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { AGE_GROUPS } from "@/types/Story";
import { MAX_ISO_WEEKS } from "@/utils/weekUtils";
import { IllustrationFilters, IllustrationTodo, illustrationApi } from "@/api/illustrations.api";
import { shrinkImage } from "@/utils/illustrationImport";
import { IllustrationTodoRow } from "@/components/Illustrations/IllustrationTodoRow";
import { IllustrationImportDialog } from "@/components/Illustrations/IllustrationImportDialog";
import { CanvasToolDialog } from "@/components/Illustrations/CanvasToolDialog";

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
  const [weekNumber, setWeekNumber] = useState<number | undefined>();
  const [ageGroup, setAgeGroup] = useState("all");
  const [hasImage, setHasImage] = useState<"no" | "all">("no");
  const filters: IllustrationFilters = { weekNumber, ageGroup, hasImage };
  const queryKey = ["illustrations", filters];

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
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">{t("illustrations.title")}</h1>
          <p className="text-muted-foreground">{t("illustrations.subtitle")}</p>
        </header>

        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="illustrations-week">{t("illustrations.filters.week")}</Label>
              <Input
                id="illustrations-week"
                type="number"
                min={1}
                max={MAX_ISO_WEEKS}
                value={weekNumber ?? ""}
                placeholder={t("illustrations.filters.allWeeks")}
                onChange={event => {
                  const value = Number(event.target.value);
                  setWeekNumber(Number.isInteger(value) && value >= 1 && value <= MAX_ISO_WEEKS ? value : undefined);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("illustrations.filters.age")}</Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("illustrations.filters.allAges")}</SelectItem>
                  {AGE_GROUPS.map(age => <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("illustrations.filters.show")}</Label>
              <Select value={hasImage} onValueChange={value => setHasImage(value as "no" | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">{t("illustrations.filters.withoutImage")}</SelectItem>
                  <SelectItem value="all">{t("illustrations.filters.all")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => exportPrompts("txt")} disabled={items.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {t("illustrations.exportTxt")}
            </Button>
            <Button type="button" variant="outline" onClick={() => exportPrompts("json")} disabled={items.length === 0}>
              <FileJson className="mr-2 h-4 w-4" />
              {t("illustrations.exportJson")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCanvasOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" />
              {t("illustrations.canvas.button")}
            </Button>
            <Button type="button" onClick={() => setImportOpen(true)} disabled={items.length === 0}>
              <ImagePlus className="mr-2 h-4 w-4" />
              {t("illustrations.importImages")}
            </Button>
            {batch ? (
              <Button type="button" variant="destructive" onClick={() => { stopBatch.current = true; }}>
                <Square className="mr-2 h-4 w-4" />
                {t("illustrations.stopBatch", { done: batch.done, total: batch.total })}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={generateMissing} disabled={missingPrompts.length === 0 || generatingIds.size > 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("illustrations.createMissing", { count: missingPrompts.length })}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={refresh} disabled={isFetching} title={t("illustrations.refresh")}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {batch && <Progress value={(batch.done / Math.max(batch.total, 1)) * 100} />}
          <p className="text-xs text-muted-foreground">{t("illustrations.howTo")}</p>
        </section>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {hasImage === "no" ? t("illustrations.allDone") : t("illustrations.empty")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("illustrations.count", { count: items.length, done: attached.size })}
            </p>
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
