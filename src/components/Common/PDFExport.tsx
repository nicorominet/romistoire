import { useState, useEffect, useMemo } from "react";
import { ExportOptions, Story, AGE_GROUPS, PaginationParams } from "@/types/Story";
import { PDF_STYLES, PdfStyle, resolvePdfStyle } from "@/utils/pdfStyle";
import { fetchAllPdfStories, filterPdfStories } from "@/utils/pdfExport";
import { i18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Download, FileText, Filter, Search, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { systemApi } from "@/api/system.api";
import { useThemes } from "@/hooks/useThemes";
import { Theme } from "@/types/Theme";
import { ThemeSelect } from "@/components/Theme/ThemeSelect";
import { ThemeBadgeList } from "@/components/Theme/ThemeBadgeList";

interface PDFExportProps {
  availableStories: Story[];
  storyQuery: Partial<PaginationParams>;
}

const PDFExport = ({ availableStories, storyQuery }: PDFExportProps): JSX.Element => {
  const { t } = i18n;

  const [exportStories, setExportStories] = useState<Story[]>(availableStories);
  const [loadingStories, setLoadingStories] = useState<boolean>(true);
  const [storyLoadError, setStoryLoadError] = useState<string>("");
  const [reloadStories, setReloadStories] = useState<number>(0);
  const [selectedStories, setSelectedStories] = useState<string[]>([]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    stories: [],
    includeIllustrations: true,
    coverPage: true,
    tableOfContents: true,
    fontSize: "medium",
    style: "auto",
    pageSize: "a4",
    orientation: "portrait",
  });

  const { data: allThemes = [] } = useThemes();
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [storySearch, setStorySearch] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);
  // Object URL of the last generated PDF (revoked when replaced or when leaving the page)
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoadingStories(true);
    setStoryLoadError("");
    setSelectedStories([]);

    fetchAllPdfStories(storyQuery)
      .then((stories) => {
        if (cancelled) return;
        setExportStories(stories);
        setSelectedWeeks([...new Set(stories.map((story) => story.week_number))]);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : t("pdf.unknownError");
        setStoryLoadError(message);
        toast.error(t("pdf.error"), { description: message, duration: 5000 });
      })
      .finally(() => {
        if (!cancelled) setLoadingStories(false);
      });

    return () => { cancelled = true; };
  }, [storyQuery, reloadStories, t]);

  // Style used in "auto": from the age groups of the selected stories
  const resolvedStyle = useMemo(() => {
    const selected = new Set(selectedStories);
    const ages = exportStories.filter((story) => selected.has(story.id)).map((story) => String(story.age_group));
    return resolvePdfStyle(exportOptions.style ?? "auto", ages);
  }, [exportStories, selectedStories, exportOptions.style]);

  const themes: Theme[] = useMemo(() => {
    const ids = new Set(exportStories.flatMap((story) => (story.themes || []).map((theme) => theme.id)));
    return allThemes.filter((theme) => ids.has(theme.id));
  }, [exportStories, allThemes]);

  const availableWeeks = useMemo(
    () => [...new Set(exportStories.map((story) => story.week_number))].sort((a, b) => a - b),
    [exportStories],
  );

  const filteredStories = useMemo(() => filterPdfStories(exportStories, {
    themeId: selectedTheme,
    ageGroup: selectedAgeGroup,
    dateFrom,
    dateTo,
    weeks: selectedWeeks,
  }), [exportStories, selectedTheme, selectedAgeGroup, dateFrom, dateTo, selectedWeeks]);

  const visibleStories = useMemo(() => {
    const search = storySearch.trim().toLocaleLowerCase();
    if (!search) return filteredStories;
    return filteredStories.filter((story) => [
      story.title,
      story.series_name ?? "",
      ...(story.themes ?? []).map((theme) => theme.name),
    ].some((value) => value.toLocaleLowerCase().includes(search)));
  }, [filteredStories, storySearch]);

  const visibleStoryIds = useMemo(() => new Set(visibleStories.map((story) => story.id)), [visibleStories]);
  const selectedOutsideVisibleCount = selectedStories.reduce(
    (count, storyId) => count + Number(!visibleStoryIds.has(storyId)),
    0,
  );

  const activeFilterCount = Number(Boolean(selectedTheme && selectedTheme !== "default"))
    + Number(Boolean(selectedAgeGroup && selectedAgeGroup !== "default"))
    + Number(Boolean(dateFrom))
    + Number(Boolean(dateTo))
    + Number(availableWeeks.length > 0 && selectedWeeks.length < availableWeeks.length);

  useEffect(() => {
    setExportOptions((prev) => ({
      ...prev,
      stories: selectedStories,
    }));
  }, [selectedStories]);

  const handleStorySelection = (storyId: string) => {
    if (selectedStories.includes(storyId)) {
      setSelectedStories(selectedStories.filter((id) => id !== storyId));
    } else {
      setSelectedStories([...selectedStories, storyId]);
    }
  };

  const selectAllStories = () => {
    const allStoryIds = exportStories.map((story) => story.id);
    setSelectedStories(allStoryIds);
  };

  const addVisibleStories = () => {
    setSelectedStories((current) => [...new Set([...current, ...visibleStories.map((story) => story.id)])]);
  };

  const keepVisibleStoriesOnly = () => {
    setSelectedStories(visibleStories.map((story) => story.id));
  };

  const deselectAllStories = () => {
    setSelectedStories([]);
  };

  const resetFilters = () => {
    setSelectedTheme("");
    setSelectedAgeGroup("");
    setDateFrom("");
    setDateTo("");
    setSelectedWeeks(availableWeeks);
    setStorySearch("");
  };

  const generatePDF = async () => {
    if (selectedStories.length === 0) {
      toast.error(t("pdf.noStories"), { description: t("pdf.pleaseSelectStories"), duration: 3000 });
      return;
    }

    setGenerating(true);
    setPdfUrl("");

    try {
      const options = {
        ...exportOptions,
        stories: selectedStories,
        coverTitle: exportOptions.coverTitle || t("pdf.defaultCoverTitle"),
        coverSubtitle:
          exportOptions.coverSubtitle ||
          `${t("pdf.exportDate")}: ${formatDate(new Date())}`,
      };

      // The server sends the PDF file itself
      const file = await systemApi.exportPdf(options);
      if (!(file instanceof Blob) || file.type !== "application/pdf") {
        throw new Error(t("pdf.invalidResponse"));
      }

      setPdfFilename(`histoires_${new Date().toISOString().slice(0, 10)}.pdf`);
      setPdfUrl(URL.createObjectURL(file));
      toast.success(t("pdf.success"), { description: t("pdf.readyToDownload"), duration: 5000 });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(t("pdf.error"), { description: error instanceof Error ? error.message : t("pdf.unknownError"), duration: 5000 });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("pdf.title")}
        </CardTitle>
        <CardDescription>{t("pdf.exportDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(loadingStories || storyLoadError) && (
          <div className="rounded-lg border p-4" role={storyLoadError ? "alert" : "status"}>
            {loadingStories && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
            {storyLoadError && (
              <div className="flex items-center justify-between gap-3 text-sm text-destructive">
                <span>{storyLoadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setReloadStories((attempt) => attempt + 1)}>
                  {t("common.retry")}
                </Button>
              </div>
            )}
          </div>
        )}

        <section aria-labelledby="pdf-filters-heading" className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 id="pdf-filters-heading" className="flex items-center gap-2 font-semibold">
                <Filter className="h-4 w-4 text-primary" />
                {t("pdf.filters")}
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {t("pdf.activeFilters", { count: String(activeFilterCount) })}
                  </span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground">{t("pdf.filtersHint")}</p>
            </div>
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4" />
                {t("pdf.clearFilters")}
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{t("pdf.filterByTheme")}</Label>
              <ThemeSelect
                themes={themes}
                value={selectedTheme && selectedTheme !== "default" ? selectedTheme : null}
                onChange={(themeId) => setSelectedTheme(themeId ?? "default")}
                placeholder={t("pdf.selectTheme")}
                clearLabel={t("stories.allThemes")}
                showCounts={false}
                disabled={loadingStories || Boolean(storyLoadError)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-age">{t("pdf.filterByAge")}</Label>
              <Select value={selectedAgeGroup || "default"} onValueChange={setSelectedAgeGroup} disabled={loadingStories || Boolean(storyLoadError)}>
                <SelectTrigger id="pdf-age"><SelectValue placeholder={t("pdf.selectAgeGroup")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("stories.allAges")}</SelectItem>
                  {AGE_GROUPS.map((age) => <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">{t("pdf.dateFrom")}</Label>
              <Input id="dateFrom" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} disabled={loadingStories} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">{t("pdf.dateTo")}</Label>
              <Input id="dateTo" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} disabled={loadingStories} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t("pdf.filterByWeek")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("pdf.weeksSelected", { selected: String(selectedWeeks.length), total: String(availableWeeks.length) })}</span>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={loadingStories || selectedWeeks.length === availableWeeks.length} onClick={() => setSelectedWeeks(availableWeeks)}>
                  {t("pdf.selectAll")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={loadingStories || selectedWeeks.length === 0} onClick={() => setSelectedWeeks([])}>
                  {t("pdf.deselectAll")}
                </Button>
              </div>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-md border bg-background p-2">
              {availableWeeks.map((week) => (
                <label key={week} htmlFor={`week-${week}`} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent">
                  <Checkbox
                    id={`week-${week}`}
                    checked={selectedWeeks.includes(week)}
                    disabled={loadingStories}
                    onCheckedChange={(checked) => setSelectedWeeks((current) => (
                      checked ? [...new Set([...current, week])] : current.filter((item) => item !== week)
                    ))}
                  />
                  <span>{t("week.title")} {week}</span>
                </label>
              ))}
              {!loadingStories && availableWeeks.length === 0 && (
                <span className="p-2 text-sm text-muted-foreground">{t("stories.empty")}</span>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="pdf-stories-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 id="pdf-stories-heading" className="font-semibold">{t("pdf.selectStories")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("pdf.selectionSummary", {
                  selected: String(selectedStories.length),
                  visible: String(visibleStories.length),
                  total: String(exportStories.length),
                  hidden: String(selectedOutsideVisibleCount),
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllStories} disabled={loadingStories || Boolean(storyLoadError) || exportStories.length === 0 || selectedStories.length === exportStories.length}>
                {t("pdf.selectAllCount", { count: String(exportStories.length) })}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addVisibleStories} disabled={loadingStories || Boolean(storyLoadError) || visibleStories.length === 0 || visibleStories.every((story) => selectedStories.includes(story.id))}>
                {t("pdf.addVisible", { count: String(visibleStories.length) })}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={keepVisibleStoriesOnly} disabled={loadingStories || Boolean(storyLoadError) || visibleStories.length === 0 || (selectedStories.length === visibleStories.length && selectedOutsideVisibleCount === 0)}>
                {t("pdf.keepVisible", { count: String(visibleStories.length) })}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={deselectAllStories} disabled={selectedStories.length === 0}>
                {t("pdf.deselectAll")}
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={storySearch} onChange={(event) => setStorySearch(event.target.value)} placeholder={t("pdf.searchStories")} className="pl-9" aria-label={t("pdf.searchStories")} />
          </div>

          <div className="grid max-h-[28rem] gap-2 overflow-y-auto rounded-lg border bg-muted/10 p-2">
            {visibleStories.map((story) => {
              const checked = selectedStories.includes(story.id);
              return (
                <label key={story.id} htmlFor={`story-${story.id}`} className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/30 ${checked ? "border-primary/50 bg-primary/5" : ""}`}>
                  <Checkbox id={`story-${story.id}`} checked={checked} onCheckedChange={() => handleStorySelection(story.id)} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{story.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <ThemeBadgeList themes={story.themes} max={3} />
                      <span>{t(`ages.${story.age_group}`)}</span>
                      <span>{t("week.title")} {story.week_number} / {t(`week.day.${story.day_order}`)}</span>
                      {story.series_name && <span className="font-semibold text-story-purple-600 dark:text-story-purple-400">{story.series_name}</span>}
                    </span>
                  </span>
                </label>
              );
            })}
            {!loadingStories && !storyLoadError && visibleStories.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {storySearch ? t("pdf.noMatchingStories") : t("stories.empty")}
              </div>
            )}
          </div>
        </section>

        <Accordion type="single" collapsible>
          <AccordionItem value="options" className="rounded-lg border px-4">
            <AccordionTrigger className="py-4">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4" />{t("pdf.options")}</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-3">
                  <Label>{t("pdf.documentContents")}</Label>
                  {([
                    ["includeIllustrations", "includeIllustrations"],
                    ["coverPage", "coverPage"],
                    ["tableOfContents", "tableOfContents"],
                  ] as const).map(([key, labelKey]) => (
                    <label key={key} htmlFor={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        id={key}
                        checked={Boolean(exportOptions[key])}
                        onCheckedChange={(checked) => setExportOptions((current) => ({ ...current, [key]: Boolean(checked) }))}
                      />
                      {t(`pdf.${labelKey}`)}
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdfStyle">{t("pdf.style")}</Label>
                  <Select value={exportOptions.style ?? "auto"} onValueChange={(value) => setExportOptions((current) => ({ ...current, style: value as PdfStyle }))}>
                    <SelectTrigger id="pdfStyle"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PDF_STYLES.map((style) => <SelectItem key={style} value={style}>{t(`pdf.styles.${style}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {(exportOptions.style ?? "auto") === "auto"
                      ? `${t("pdf.styleAuto", { style: t(`pdf.styles.${resolvedStyle}`) })} — ${t("pdf.styles.autoDesc")}`
                      : t(`pdf.styles.${exportOptions.style}Desc`)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fontSize">{t("pdf.fontSize")}</Label>
                    <Select value={exportOptions.fontSize} onValueChange={(value) => setExportOptions((current) => ({ ...current, fontSize: value as ExportOptions["fontSize"] }))}>
                      <SelectTrigger id="fontSize"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">{t("pdf.fontSizeSmall")}</SelectItem>
                        <SelectItem value="medium">{t("pdf.fontSizeMedium")}</SelectItem>
                        <SelectItem value="large">{t("pdf.fontSizeLarge")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="pageSize">{t("pdf.pageSize")}</Label>
                      <Select value={exportOptions.pageSize} onValueChange={(value) => setExportOptions((current) => ({ ...current, pageSize: value as ExportOptions["pageSize"] }))}>
                        <SelectTrigger id="pageSize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">A4</SelectItem>
                          <SelectItem value="a5">A5</SelectItem>
                          <SelectItem value="letter">Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orientation">{t("pdf.orientation")}</Label>
                      <Select value={exportOptions.orientation} onValueChange={(value) => setExportOptions((current) => ({ ...current, orientation: value as ExportOptions["orientation"] }))}>
                        <SelectTrigger id="orientation"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">{t("pdf.portrait")}</SelectItem>
                          <SelectItem value="landscape">{t("pdf.landscape")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t("pdf.selectionSummary", {
              selected: String(selectedStories.length),
              visible: String(visibleStories.length),
              total: String(exportStories.length),
              hidden: String(selectedOutsideVisibleCount),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={selectedStories.length === 0 || generating || loadingStories || Boolean(storyLoadError)} onClick={generatePDF} className="bg-story-purple hover:bg-story-purple-600">
              {generating ? <><div className="spinner mr-2" />{t("pdf.downloading")}</> : <><FileText className="mr-2 h-4 w-4" />{t("pdf.generatePdf")}</>}
            </Button>
            {pdfUrl && (
              <Button variant="outline" asChild>
                <a href={pdfUrl} download={pdfFilename}><Download className="mr-2 h-4 w-4" />{t("pdf.download")}</a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFExport;
