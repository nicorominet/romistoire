import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/constants";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { i18n } from "@/lib/i18n";
import { Save, ArrowLeft, PenLine, Image } from "lucide-react";
import { toast } from "sonner";
import StoryIllustrations from "@/components/Story/StoryEditor/StoryIllustrations";
import StorySettings from "@/components/Story/StorySettings";
import { formSchema, FormValues } from "@/components/Story/StoryEditor/formSchema";
import useStoryData from "@/hooks/useStoryData";
import StoryContent from "@/components/Story/StoryEditor/StoryContent";
import RestoreVersionCard from "@/components/Story/EditStory/RestoreVersionCard";
import { Theme } from "@/types/Theme";
import { Series } from "@/types/Series";
import { Story, StoryVersion, AgeGroup } from "@/types/Story";
import { storyApi } from "@/api/stories.api";
import { useThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { getDayOrder } from "@/utils/dayUtils";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { withOnePrimary } from "@/components/Theme/ThemeSelect";
import { StoryTheme } from "@/types/Theme";

const EditStoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = i18n;

  const {
    story,
    loading,
    error,
    illustrations,
    weeklyThemes,
    addIllustrationToBackend,
    deleteIllustration,
    reorderIllustrations,
  } = useStoryData({ id });

  const { data: availableThemes = [] } = useThemes();
  const { data: availableSeries = [] } = useSeries();

  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef(false);
  const [weeklyTheme, setWeeklyTheme] = useState<string | null>(null);
  const [sortedDayOfWeekOptions, setSortedDayOfWeekOptions] = useState([
    { value: "Monday", label: t("days.monday") },
    { value: "Tuesday", label: t("days.tuesday") },
    { value: "Wednesday", label: t("days.wednesday") },
    { value: "Thursday", label: t("days.thursday") },
    { value: "Friday", label: t("days.friday") },
    { value: "Saturday", label: t("days.saturday") },
    { value: "Sunday", label: t("days.sunday") },
  ]);
  const [formInitialised, setFormInitialised] = useState(false);
  const [versions, setVersions] = useState<StoryVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      themes: [],
      ageGroup: "4-6",
      language: "fr",
      dayOfWeek: "",
      weekNumber: "1",
      seriesName: "",
      version: 1,
    },
  });
  const editedTitle = useWatch({ control: form.control, name: "title" });

  const { dialog: unsavedChangesDialog, allowNavigation } = useUnsavedChangesGuard(form.formState.isDirty || saving);

  const beginSave = () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    return true;
  };

  const endSave = () => {
    savingRef.current = false;
    setSaving(false);
  };

  const fetchVersions = useCallback(async () => {
    try {
      const data = await storyApi.getVersions(id!);
      setVersions(data);
    } catch (error) {
      console.error("Error fetching versions:", error);
      toast.error(t("common.errors.failedToLoadVersions"));
    }
  }, [id, t]);

  useEffect(() => {
    if (id) {
      fetchVersions();
    }
  }, [id, fetchVersions]);

  useEffect(() => {
    if (story && !formInitialised) {
      const dayOfWeekOptions = [
        { value: "Monday", label: t("days.monday") },
        { value: "Tuesday", label: t("days.tuesday") },
        { value: "Wednesday", label: t("days.wednesday") },
        { value: "Thursday", label: t("days.thursday") },
        { value: "Friday", label: t("days.friday") },
        { value: "Saturday", label: t("days.saturday") },
        { value: "Sunday", label: t("days.sunday") },
      ];
      const dayOfWeekValue = dayOfWeekOptions[story.day_order - 1]?.value || "";

      form.reset({
        title: story.title,
        content: story.content,
        themes: withOnePrimary(story.themes.map((theme) => ({ id: theme.id, isPrimary: Boolean((theme as StoryTheme).isPrimary) }))),
        ageGroup: story.age_group as AgeGroup,
        // Legacy free-text locales ("fr-FR", typos) fall back to French; the select only offers fr / en
        language: story.locale === "en" ? "en" : "fr",
        dayOfWeek: dayOfWeekValue,
        weekNumber: story.week_number.toString(),
        seriesName: story.series_name || "",
        version: story.version,
      });

      setSortedDayOfWeekOptions((prevOptions) => {
        const currentIndex = prevOptions.findIndex(
          (option) => option.value === dayOfWeekValue
        );
        if (currentIndex === -1) {
          return prevOptions;
        }
        const currentDayOption = prevOptions[currentIndex];
        const remainingDays = [
          ...prevOptions.slice(0, currentIndex),
          ...prevOptions.slice(currentIndex + 1),
        ];
        return [currentDayOption, ...remainingDays];
      });
      setFormInitialised(true);

      const theme = weeklyThemes.find(
        (theme) => theme.week_number === story.week_number
      );
      setWeeklyTheme(theme ? theme.theme_name : null);
    }
  }, [story, formInitialised, weeklyThemes, t, form]);



  const onSubmit = async (values: FormValues) => {
    if (!id || !beginSave()) return;
    try {

      const dayOrder = getDayOrder(values.dayOfWeek);
      if (dayOrder < 1 || dayOrder > 7) {
        throw new Error("Invalid day_order value");
      }

      const payload: Partial<Story> = {
        title: values.title,
        content: values.content,
        themes: values.themes.map(({ id, isPrimary }) => ({ id, isPrimary } as unknown as Theme)),
        age_group: values.ageGroup,
        locale: values.language,
        day_order: dayOrder,
        week_number: parseInt(values.weekNumber, 10),
        series_name: values.seriesName,
      };

      const updatedStory = await storyApi.update(id!, payload);

      toast.success(t("story.updateSuccess"));
      if (updatedStory?.aliasSeries) toast.warning(t("story.aliasCreated", { series: updatedStory.aliasSeries.name }));
      allowNavigation();
      navigate(APP_ROUTES.STORY_DETAIL(id));
    } catch (err) {
      toast.error(t("story.updateError"));
      console.error("Error updating story:", err);
    } finally {
      endSave();
    }
  };

  const handleBack = () => {
    navigate(APP_ROUTES.STORY_DETAIL(id!));
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion || !beginSave()) return;
    try {
      await storyApi.restoreVersion(id!, selectedVersion);
      
      toast.success(t("story.restoreSuccess"));
      allowNavigation();
      navigate(APP_ROUTES.STORY_DETAIL(id!));
    } catch (err) {
      toast.error(t("story.restoreError"));
      console.error("Error restoring version:", err);
    } finally {
      endSave();
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
          <div className="spinner"></div>
      </PageLayout>
    );
  }

  if (error || !story) {
    return (
      <PageLayout>
          <Card className="max-w-2xl mx-auto bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-red-500">
                {t("common.error")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error || t("story.loadError")}</p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => navigate(APP_ROUTES.STORIES)}
                variant="outline"
                className="flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Button>
            </CardFooter>
          </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
        <div className="mb-6 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Button
            disabled={saving}
            onClick={handleBack}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">
            {t("story.edit")} - {editedTitle}
            {weeklyTheme && ` (${t("story.weeklyTheme")}: ${weeklyTheme})`}
          </h1>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={saving} aria-busy={saving} className="min-w-0 border-0 p-0">
            <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 ${saving ? "pointer-events-none opacity-70" : ""}`}>
              <div className="lg:col-span-3">
                <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-gray-100">
                      {t("story.content")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="editor">
                      <TabsList className="mb-4">
                        <TabsTrigger
                          value="editor"
                          className="flex items-center gap-1"
                        >
                          <PenLine className="h-4 w-4" />
                          {t("story.editor")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="illustrations"
                          className="flex items-center gap-1"
                        >
                          <Image className="h-4 w-4" />
                          {t("story.illustrations")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="editor">
                        <StoryContent disabled={saving} />
                      </TabsContent>

                      <TabsContent value="illustrations">
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t("story.illustrationsSavedImmediately")}</p>
                        <StoryIllustrations
                          illustrations={illustrations}
                          addIllustrationToBackend={addIllustrationToBackend}
                          deleteIllustration={deleteIllustration}
                          reorderIllustrations={reorderIllustrations}
                          illustrationPrompt={story.illustration_prompt}
                          disabled={saving}
                        />

                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-gray-100">
                      {t("story.settings")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StorySettings
                      availableThemes={availableThemes}
                      weeklyThemes={weeklyThemes}
                      sortedDayOfWeekOptions={sortedDayOfWeekOptions}
                      story={story}
                      availableSeries={availableSeries as unknown as Series[]}
                      disabled={saving}
                    />
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2">
                    {story.audio_path && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">{t("story.audio.willBeDeleted")}</p>
                    )}
                    <Button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-story-purple hover:bg-story-purple-600 flex items-center gap-1 text-gray-900 dark:text-gray-100"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? t("common.saving") : t("common.save")}
                    </Button>
                  </CardFooter>
                </Card>

                <RestoreVersionCard
                    versions={versions}
                    selectedVersion={selectedVersion}
                    setSelectedVersion={setSelectedVersion}
                    handleRestoreVersion={handleRestoreVersion}
                    saving={saving}
                    hasUnsavedChanges={form.formState.isDirty}
                />
              </div>
            </div>
            </fieldset>
          </form>
        </FormProvider>
        {unsavedChangesDialog}
    </PageLayout>
  );
};

export default EditStoryPage;