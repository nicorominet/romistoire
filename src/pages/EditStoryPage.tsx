import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
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
import { Story } from "@/types/Story";
import { themeApi } from "@/api/themes.api";
import { storyApi, seriesApi } from "@/api/stories.api";

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
  } = useStoryData({ id });

  const [saving, setSaving] = useState<boolean>(false);
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [availableSeries, setAvailableSeries] = useState<Series[]>([]);
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
  const [darkMode, setDarkMode] = useState<boolean>(
    document.documentElement.classList.contains("dark")
  );
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      themes: [],
      ageGroup: "4-6",
      language: "",
      dayOfWeek: "",
      weekNumber: "1",
      seriesName: "",
      version: 1,
    },
  });

  const fetchThemes = useCallback(async () => {
    try {
      const data = (await themeApi.getAll()) as any;
      setAvailableThemes(data);
    } catch (error) {
      console.error("Error fetching themes:", error);
      toast.error(t("common.errors.failedToLoadThemes"));
    }
  }, []);

  const fetchSeries = useCallback(async () => {
    try {
      const data = (await seriesApi.getAll()) as any;
      setAvailableSeries(data);
    } catch (error) {
      console.error("Error fetching series:", error);
    }
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      const data = (await storyApi.getVersions(id!)) as any;
      setVersions(data);
    } catch (error) {
      console.error("Error fetching versions:", error);
      toast.error(t("common.errors.failedToLoadVersions"));
    }
  }, [id]);

  useEffect(() => {
    const handleDarkModeChange = () => {
      setDarkMode(document.documentElement.classList.contains("dark"));
    };

    window.addEventListener("darkModeChanged", handleDarkModeChange);

    return () => {
      window.removeEventListener("darkModeChanged", handleDarkModeChange);
    };
  }, []);

  useEffect(() => {
    fetchThemes();
    fetchSeries();
  }, [fetchThemes, fetchSeries]);

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
        themes: story.themes.map((theme) => theme.id),
        ageGroup: story.age_group as "2-3" | "4-6" | "7-9" | "10-12",
        language: story.locale,
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
    if (!id) return;

    setSaving(true);
    try {
      const updatedVersion = story.version + 1;

      // Conversion du jour texte en numéro (1 = Monday, 7 = Sunday)
      const dayOfWeekMap = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const dayOrder = dayOfWeekMap.indexOf(values.dayOfWeek) + 1;
      if (dayOrder < 1 || dayOrder > 7) {
        throw new Error("Invalid day_order value");
      }

      const payload: Partial<Story> = {
        title: values.title,
        content: values.content,
        themes: values.themes.map((themeId) => ({
          id: themeId,
          isPrimary: values.themes[0] === themeId,
        } as unknown as Theme)),
        age_group: values.ageGroup,
        locale: values.language,
        day_order: dayOrder,
        week_number: parseInt(values.weekNumber, 10),
        series_name: values.seriesName,
        version: updatedVersion,
      };

      const updateRes = await storyApi.update(id!, payload as any);

      const updatedStory = updateRes as Story;
      toast.success(t("story.updateSuccess"));
      navigate(`/stories/${id}`);
    } catch (err) {
      toast.error(t("story.updateError"));
      console.error("Error updating story:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate(`/stories/${id}`);
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;

    setSaving(true);
    try {
      await storyApi.restoreVersion(id!, selectedVersion);
      
      toast.success(t("story.restoreSuccess"));
      navigate(`/stories/${id}`);
    } catch (err) {
      toast.error(t("story.restoreError"));
      console.error("Error restoring version:", err);
    } finally {
      setSaving(false);
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
              <p>{error || "Unable to load story"}</p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => navigate("/stories")}
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
            onClick={handleBack}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <h1 className="text-3xl font-bold text-story-purple-800 dark:text-story-purple-200">
            {t("story.edit")} - {story.title}
            {weeklyTheme && ` (${t("story.weeklyTheme")}: ${weeklyTheme})`}
          </h1>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Card className="bg-white dark:bg-gray-800">
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
                        <StoryContent />
                      </TabsContent>

                      <TabsContent value="illustrations">
                        <StoryIllustrations
                          illustrations={illustrations}
                          addIllustrationToBackend={addIllustrationToBackend}
                          deleteIllustration={deleteIllustration}
                        />

                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="bg-white dark:bg-gray-800">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-gray-100">
                      {t("story.settings")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StorySettings
                      availableThemes={availableThemes.map((theme) => ({
                        ...theme,
                        created_at: story.created_at || new Date().toISOString(),
                      }))}
                      setAvailableThemes={setAvailableThemes}
                      weeklyThemes={weeklyThemes}
                      sortedDayOfWeekOptions={sortedDayOfWeekOptions}
                      story={story}
                      availableSeries={availableSeries}
                    />
                  </CardContent>
                  <CardFooter>
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
                />
              </div>
            </div>
          </form>
        </FormProvider>
    </PageLayout>
  );
};

export default EditStoryPage;