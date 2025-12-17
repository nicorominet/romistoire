import { useState, useEffect } from "react";
import { ExportOptions, Story, AgeGroup, AGE_GROUPS } from "@/types/Story";
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
import { useToast } from "@/hooks/use-toast";
import { systemApi } from "@/api/system.api";

interface PDFExportProps {
  availableStories: Story[];
}

const PDFExport = ({ availableStories }: PDFExportProps): JSX.Element => {
  const { t } = i18n;
  const { toast } = useToast();

  const [selectedStories, setSelectedStories] = useState<string[]>([]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    stories: [],
    includeIllustrations: true,
    coverPage: true,
    tableOfContents: true,
    fontSize: "medium",
    fontFamily: "helvetica",
    pageSize: "a4",
    orientation: "portrait",
  });

  const [themes, setThemes] = useState<{ id: string; name: string }[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  useEffect(() => {
    const uniqueThemesMap = new Map<string, string>();
    availableStories.forEach((story) => {
      if (Array.isArray(story.themes)) {
        story.themes.forEach((theme) => {
          if (theme && theme.id) uniqueThemesMap.set(theme.id, theme.name);
        });
      }
    });
    const uniqueThemes: { id: string; name: string }[] = Array.from(
      uniqueThemesMap,
      ([id, name]) => ({ id, name })
    );
    setThemes(uniqueThemes);
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

    toast({
      title: "Filters Applied",
      description: `Selected ${filteredIds.length} stories based on your filters.`,
      duration: 3000,
    });
  };

  const generatePDF = async () => {
    if (selectedStories.length === 0) {
      toast({
        title: t("pdf.noStories"),
        description: t("pdf.pleaseSelectStories"),
        variant: "destructive",
        duration: 3000,
      });
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

      const data: any = await systemApi.exportPdf(options);

      if (!data?.url) {
        throw new Error(t("pdf.invalidResponse"));
      }

      setPdfUrl(data.url);
      toast({
        title: t("pdf.success"),
        description: t("pdf.readyToDownload"),
        duration: 5000,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: t("pdf.error"),
        description:
          error instanceof Error ? error.message : t("pdf.unknownError"),
        variant: "destructive",
        duration: 5000,
      });
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
                        {Array.isArray(story.themes) &&
                          story.themes.map((theme) => (
                            <span
                              key={theme.id}
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: theme.color, color: "#fff" }}
                            >
                              {theme.name}
                            </span>
                          ))}
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
                <Label htmlFor="fontFamily">{t("pdf.fontFamily")}</Label>
                <Select
                  value={exportOptions.fontFamily}
                  onValueChange={(value) =>
                    setExportOptions({ ...exportOptions, fontFamily: value })
                  }
                >
                  <SelectTrigger id="fontFamily">
                    <SelectValue placeholder={t("pdf.selectFont")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="helvetica">Helvetica</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                    <SelectItem value="times">Times</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Select
                    value={selectedTheme || "default"}
                    onValueChange={setSelectedTheme}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("pdf.selectTheme")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("stories.allThemes")}</SelectItem>
                      {themes.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <Button
              variant="outline"
              onClick={() => window.open(pdfUrl, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("pdf.download")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFExport;
