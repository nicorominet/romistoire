import { useState, useEffect, useMemo } from "react";
import { ExportOptions, Story, AgeGroup, AGE_GROUPS } from "@/types/Story";
import { PDF_STYLES, PdfStyle, resolvePdfStyle } from "@/utils/pdfStyle";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Download, FileText, Filter, Book, Settings } from "lucide-react";
import { toast } from "sonner";
import { systemApi } from "@/api/system.api";
import { useThemes } from "@/hooks/useThemes";
import { Theme } from "@/types/Theme";
import { ThemeSelect } from "@/components/Theme/ThemeSelect";
import { ThemeBadgeList } from "@/components/Theme/ThemeBadgeList";

interface PDFExportProps {
  availableStories: Story[];
}

const PDFExport = ({ availableStories }: PDFExportProps): JSX.Element => {
  const { t } = i18n;

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
  const [generating, setGenerating] = useState<boolean>(false);
  // Object URL of the last generated PDF (revoked when replaced or when leaving the page)
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Style used in "auto": from the age groups of the selected stories
  const resolvedStyle = useMemo(() => {
    const selected = new Set(selectedStories);
    const ages = availableStories.filter((story) => selected.has(story.id)).map((story) => String(story.age_group));
    return resolvePdfStyle(exportOptions.style ?? "auto", ages);
  }, [availableStories, selectedStories, exportOptions.style]);

  // The export covers the loaded stories: only offer their themes (with full theme data for the picker)
  const themes: Theme[] = useMemo(() => {
    const ids = new Set(availableStories.flatMap((story) => (story.themes || []).map((theme) => theme.id)));
    return allThemes.filter((theme) => ids.has(theme.id));
  }, [availableStories, allThemes]);

  useEffect(() => {
    const uniqueWeeks = [
      ...new Set(availableStories.map((story) => story.week_number)),
    ];
    setSelectedWeeks(uniqueWeeks);
  }, [availableStories]);

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
    const allStoryIds = availableStories.map((story) => story.id);
    setSelectedStories(allStoryIds);
  };

  const deselectAllStories = () => {
    setSelectedStories([]);
  };

  const applyFilters = () => {
    let filteredStories = [...availableStories];

    if (selectedTheme && selectedTheme !== "default") {
      filteredStories = filteredStories.filter(
        (story) =>
          Array.isArray(story.themes) &&
          story.themes.some((theme) => theme.id === selectedTheme)
      );
    }

    if (selectedAgeGroup && selectedAgeGroup !== "default") {
      filteredStories = filteredStories.filter(
        (story) => story.age_group === selectedAgeGroup
      );
    }

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
      const toDate = dateTo ? new Date(dateTo) : new Date();

      filteredStories = filteredStories.filter((story) => {
        const storyDate = new Date(story.created_at);
        return storyDate >= fromDate && storyDate <= toDate;
      });
    }

    if (selectedWeeks.length > 0) {
      filteredStories = filteredStories.filter((story) =>
        selectedWeeks.includes(story.week_number)
      );
    }

    const filteredIds = filteredStories.map((story) => story.id);
    setSelectedStories(filteredIds);

    setExportOptions((prev) => ({
      ...prev,
      stories: filteredIds,
      theme: selectedTheme,
      ageGroups:
        selectedAgeGroup && selectedAgeGroup !== "default"
          ? [selectedAgeGroup as AgeGroup]
          : undefined,
      dateFrom,
      dateTo,
      weekNumbers: selectedWeeks.length > 0 ? selectedWeeks : undefined,
    }));

    toast.success(t("pdf.filtersApplied"), { description: t("pdf.filtersAppliedDesc", { count: String(filteredIds.length) }), duration: 3000 });
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("pdf.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stories" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="stories" className="flex items-center gap-1">
              <Book className="h-4 w-4" />
              {t("pdf.selectStories")}
            </TabsTrigger>
            <TabsTrigger value="options" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              {t("pdf.options")}
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              {t("pdf.filters")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stories">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={selectAllStories}>
                  {t("pdf.selectAll")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllStories}
                >
                  {t("pdf.deselectAll")}
                </Button>
              </div>

              <div className="grid gap-2 max-h-80 overflow-y-auto p-2">
                {availableStories.map((story) => (
                  <div
                    key={story.id}
                    className="flex items-center space-x-2 p-2 border rounded-md hover:bg-accent/50"
                  >
                    <Checkbox
                      id={`story-${story.id}`}
                      checked={selectedStories.includes(story.id)}
                      onCheckedChange={() => handleStorySelection(story.id)}
                    />
                    <Label
                      htmlFor={`story-${story.id}`}
                      className="flex flex-col cursor-pointer flex-1"
                    >
                      <span className="font-medium">{story.title}</span>
                      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                        <ThemeBadgeList themes={story.themes} max={3} />
                        <span>•</span>
                        <span>{t(`ages.${story.age_group}`)}</span>
                        <span>•</span>
                        <span>
                          {t("week.title")} {story.week_number} /{" "}
                          {t(`week.day.${story.day_order}`)}
                        </span>
                        {story.series_name && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-story-purple-600 dark:text-story-purple-400">
                              {story.series_name}
                            </span>
                          </>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}

                {availableStories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("stories.empty")}
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                Selected: {selectedStories.length} / {availableStories.length}{" "}
                stories
              </div>
            </div>
          </TabsContent>

          <TabsContent value="options">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t("pdf.includeIllustrations")}</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeIllustrations"
                    checked={exportOptions.includeIllustrations}
                    onCheckedChange={(checked) =>
                      setExportOptions({
                        ...exportOptions,
                        includeIllustrations: !!checked,
                      })
                    }
                  />
                  <Label htmlFor="includeIllustrations">
                    {t("pdf.includeIllustrations")}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("pdf.coverPage")}</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="coverPage"
                    checked={exportOptions.coverPage}
                    onCheckedChange={(checked) =>
                      setExportOptions({
                        ...exportOptions,
                        coverPage: !!checked,
                      })
                    }
                  />
                  <Label htmlFor="coverPage">{t("pdf.coverPage")}</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("pdf.tableOfContents")}</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tableOfContents"
                    checked={exportOptions.tableOfContents}
                    onCheckedChange={(checked) =>
                      setExportOptions({
                        ...exportOptions,
                        tableOfContents: !!checked,
                      })
                    }
                  />
                  <Label htmlFor="tableOfContents">
                    {t("pdf.tableOfContents")}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontSize">{t("pdf.fontSize")}</Label>
                <RadioGroup
                  id="fontSize"
                  value={exportOptions.fontSize}
                  onValueChange={(value: any) =>
                    setExportOptions({ ...exportOptions, fontSize: value })
                  }
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="small" id="fontSize-small" />
                    <Label htmlFor="fontSize-small">
                      {t("pdf.fontSizeSmall")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="medium" id="fontSize-medium" />
                    <Label htmlFor="fontSize-medium">
                      {t("pdf.fontSizeMedium")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="large" id="fontSize-large" />
                    <Label htmlFor="fontSize-large">
                      {t("pdf.fontSizeLarge")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdfStyle">{t("pdf.style")}</Label>
                <Select
                  value={exportOptions.style ?? "auto"}
                  onValueChange={(value) =>
                    setExportOptions({ ...exportOptions, style: value as PdfStyle })
                  }
                >
                  <SelectTrigger id="pdfStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PDF_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>{t(`pdf.styles.${style}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(exportOptions.style ?? "auto") === "auto"
                    ? `${t("pdf.styleAuto", { style: t(`pdf.styles.${resolvedStyle}`) })} — ${t("pdf.styles.autoDesc")}`
                    : t(`pdf.styles.${exportOptions.style}Desc`)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pageSize">{t("pdf.pageSize")}</Label>
                <Select
                  value={exportOptions.pageSize}
                  onValueChange={(value: any) =>
                    setExportOptions({ ...exportOptions, pageSize: value })
                  }
                >
                  <SelectTrigger id="pageSize">
                    <SelectValue placeholder={t("pdf.selectPageSize")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orientation">{t("pdf.orientation")}</Label>
                <RadioGroup
                  id="orientation"
                  value={exportOptions.orientation}
                  onValueChange={(value: any) =>
                    setExportOptions({ ...exportOptions, orientation: value })
                  }
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem
                      value="portrait"
                      id="orientation-portrait"
                    />
                    <Label htmlFor="orientation-portrait">
                      {t("pdf.portrait")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem
                      value="landscape"
                      id="orientation-landscape"
                    />
                    <Label htmlFor="orientation-landscape">
                      {t("pdf.landscape")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filters">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="theme">
                <AccordionTrigger>{t("pdf.filterByTheme")}</AccordionTrigger>
                <AccordionContent>
                  <ThemeSelect
                    themes={themes}
                    value={selectedTheme && selectedTheme !== "default" ? selectedTheme : null}
                    onChange={(themeId) => setSelectedTheme(themeId ?? "default")}
                    placeholder={t("pdf.selectTheme")}
                    clearLabel={t("stories.allThemes")}
                    showCounts={false}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ageGroup">
                <AccordionTrigger>{t("pdf.filterByAge")}</AccordionTrigger>
                <AccordionContent>
                  <Select
                    value={selectedAgeGroup || "default"}
                    onValueChange={(value: any) => setSelectedAgeGroup(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("pdf.selectAgeGroup")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("stories.allAges")}</SelectItem>
                      {AGE_GROUPS.map((age) => (
                        <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="date">
                <AccordionTrigger>{t("pdf.filterByDate")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateFrom">{t("pdf.dateFrom")}</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo">{t("pdf.dateTo")}</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="week">
                <AccordionTrigger>{t("pdf.filterByWeek")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <Label>{t("pdf.selectWeeks")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set(availableStories.map((s) => s.week_number))]
                        .sort((a, b) => a - b)
                        .map((week) => (
                          <div
                            key={week}
                            className="flex items-center space-x-1"
                          >
                            <Checkbox
                              id={`week-${week}`}
                              checked={selectedWeeks.includes(week)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedWeeks([...selectedWeeks, week]);
                                } else {
                                  setSelectedWeeks(
                                    selectedWeeks.filter((w) => w !== week)
                                  );
                                }
                              }}
                            />
                            <Label htmlFor={`week-${week}`}>
                              {t("week.title")} {week}
                            </Label>
                          </div>
                        ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button className="w-full mt-4" onClick={applyFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-between">
          <Button
            disabled={selectedStories.length === 0 || generating}
            onClick={generatePDF}
            className="bg-story-purple hover:bg-story-purple-600"
          >
            {generating ? (
              <>
                <div className="spinner mr-2" />
                {t("pdf.downloading")}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {t("pdf.generatePdf")}
              </>
            )}
          </Button>

          {pdfUrl && (
            <Button variant="outline" asChild>
              <a href={pdfUrl} download={pdfFilename}>
                <Download className="mr-2 h-4 w-4" />
                {t("pdf.download")}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFExport;
