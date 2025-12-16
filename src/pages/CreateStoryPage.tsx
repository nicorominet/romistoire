import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { i18n } from "@/lib/i18n";
import { truncateText } from "@/lib/utils";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, Save, Book, Paintbrush, Wand2 } from "lucide-react";
import { toast } from "sonner";
import StorySettings from "@/components/Story/StorySettings";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormValues } from "@/components/Story/StoryEditor/formSchema";
import { AgeGroup, Illustration, Story } from "@/types/Story";
import { Series } from "@/types/Series";
import { format } from 'date-fns';

// Shared Components
import StoryContent from "@/components/Story/StoryEditor/StoryContent";
import StoryIllustrations from "@/components/Story/StoryEditor/StoryIllustrations";
import StoryGenerationTab from "@/components/Story/CreateStory/StoryGenerationTab";
// Preview Tab remains from CreateStory for now as it's simple display
import StoryPreviewTab from "@/components/Story/CreateStory/StoryPreviewTab";

import { themeApi, weeklyThemeApi } from "@/api/themes.api";
import { storyApi, seriesApi } from "@/api/stories.api";
import { systemApi } from "@/api/system.api";
import { useThemes, useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { Theme } from "@/types/Theme";



const CreateStoryPage = () => {
  const { t } = i18n;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("write");
  const { data: availableThemes = [] } = useThemes();
  const { data: weeklyThemesQuery = [] } = useWeeklyThemes();
  const weeklyThemes = weeklyThemesQuery as { week_number: number; theme_name: string }[];
  const { data: availableSeries = [] } = useSeries();

  const [weeklyTheme, setWeeklyTheme] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(document.documentElement.classList.contains("dark"));
  
  // Local state for illustrations (since they are not fully in form schema yet or handled differently)
  // EditStory handles them via backend queries. Here we hold them in state until save.
  const [illustrations, setIllustrations] = useState<Illustration[]>([]);

  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      themes: [],
      ageGroup: "4-6",
      language: "fr",
      dayOfWeek: "",
      weekNumber: "",
      seriesName: "",
      version: 1
    },
  });

  const { handleSubmit, watch, setValue, formState: { errors } } = methods;

  // Effects
  useEffect(() => {
    const handleDarkModeChange = () => setDarkMode(document.documentElement.classList.contains("dark"));
    window.addEventListener("darkModeChanged", handleDarkModeChange);
    return () => window.removeEventListener("darkModeChanged", handleDarkModeChange);
  }, []);


  const onSubmit = async (data: FormValues) => {
    // Validation
    if (!data.title || !data.content || data.themes.length === 0) {
      toast.error(t("create.error.requiredFields"));
      return;
    }

    const truncatedTitle = truncateText(data.title, 255);
    // Sanitize content
    const sanitizedContent = data.content.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const payload: Partial<Story> = {
      title: truncatedTitle,
      content: sanitizedContent,
      themes: data.themes.map((id: string) => ({ id } as Theme)),
      age_group: data.ageGroup as AgeGroup,
      locale: data.language,
      day_order: +data.dayOfWeek || 1, // simplified logic or mapping needed if dayOfWeek is string "Monday" etc. 
      // Actually dayOfWeek in formValues is string, in Story it is number.
      week_number: parseInt(data.weekNumber, 10) || 1,
      series_name: data.seriesName,
      created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      modified_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      illustrations: illustrations.map((illustration, index) => ({
          ...illustration,
          story_id: "temp",
          position: index
      })),
      version: 1
    };

    try {
      const response = await storyApi.create(payload as any); // Api might still need any if not fully typed yet, but payload is typed
      const newStory = response as Story;
      
      toast.success(t("create.success.storyCreated"));
      navigate(`/stories/${newStory.id}`);

    } catch (error) {
      console.error("Error saving story:", error);
      toast.error(t("create.error.failedToSave"));
    }
  };

  // Handlers for Illustration Component adaptation
  const addIllustrationToBackend = async (file: File, filename?: string, fileType?: string) => {
      // For Create Mode: Upload to system to get a path, then add to local state
      const formData = new FormData();
      formData.append("image", file);
      try {
        const res = (await systemApi.uploadImage(formData)) as any;
        const { imagePath, filename: returnFilename } = res;
        
        setIllustrations(prev => [...prev, { 
            id: `temp-${Date.now()}`, // Temp ID
            story_id: "temp", // Placeholder for new story
            image_path: imagePath, 
            filename: returnFilename || filename,
            fileType: fileType 
        }]);
        toast.success(t("create.illustrate.success.imageUploaded"));
      } catch (err) {
        toast.error(t("create.error.failedToUploadImage"));
      }
  };

  const deleteIllustration = async (illustrationId: string) => {
      // For Create Mode: Just remove from local state
      setIllustrations(prev => prev.filter(img => img.id !== illustrationId));
      toast.success(t('create.illustrate.success.imageDeleted'));
  };

  const handleStoryGenerated = () => {
    toast.success(t("create.success.generatedAndSaved"));
    navigate('/stories'); 
  };
  
  const memoizedAvailableThemes = useMemo(() => availableThemes, [availableThemes]);
  const sortedDayOfWeekOptions = useMemo(() => [
      { value: "Monday", label: t("days.monday") },
      { value: "Tuesday", label: t("days.tuesday") },
      { value: "Wednesday", label: t("days.wednesday") },
      { value: "Thursday", label: t("days.thursday") },
      { value: "Friday", label: t("days.friday") },
      { value: "Saturday", label: t("days.saturday") },
      { value: "Sunday", label: t("days.sunday") },
    ], [t]);

  // Helper for Preview
  const getImageSrc = (img: any): string | undefined => {
    const pathValue = img.image_path || img.imagePath || img.path;
    if (pathValue) {
      if (pathValue.startsWith('http') || pathValue.startsWith('data:')) return pathValue;
       // Clean path
       const clean = pathValue.replace(/^\\/, '').replace(/\\/g, '/');
       return `/${clean}`;
    }
    if (img.data) return img.data;
    return undefined;
  };

  const defaultStoryForSetting = useMemo(() => ({
    id: "",
    title: watch("title"),
    content: watch("content"),
    theme_name: "",
    theme_description: "",
    theme_id: "",
    age_group: watch("ageGroup") as AgeGroup,
    week_number: parseInt(watch("weekNumber") || "1"),
    day_order: 1,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    version: 1,
    locale: watch("language"),
    illustrations: illustrations,
    themes: []
  }), [watch, illustrations]);

  return (
    <PageLayout>
        <h1 className="text-3xl font-bold text-story-purple-800 mb-6">
          {t("create.title")}
          {weeklyTheme && ` (${t("story.weeklyTheme")}: ${weeklyTheme})`}
        </h1>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Tabs
                  defaultValue="write"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="mb-4">
                  <TabsTrigger value="generate" className="flex items-center">
                      <Wand2 className="h-4 w-4 mr-1" />
                      {t("create.tabs.generate")}
                    </TabsTrigger>
                    <TabsTrigger value="write" className="flex items-center">
                      <PenLine className="h-4 w-4 mr-1" />
                      {t("create.tabs.write")}
                    </TabsTrigger>
                    <TabsTrigger value="illustrate" className="flex items-center">
                      <Paintbrush className="h-4 w-4 mr-1"  />
                      {t("create.tabs.illustrate")}
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center">
                      <Book className="h-4 w-4 mr-1"  />
                      {t("create.tabs.preview")}
                    </TabsTrigger>
                  </TabsList>

                   <TabsContent value="generate">
                    <StoryGenerationTab onStoryGenerated={handleStoryGenerated} />
                  </TabsContent>

                  <TabsContent value="write">
                     <StoryContent />
                  </TabsContent>

                  <TabsContent value="illustrate">
                     <StoryIllustrations
                        illustrations={illustrations}
                        addIllustrationToBackend={addIllustrationToBackend}
                        deleteIllustration={deleteIllustration}
                     />
                  </TabsContent>

                  <TabsContent value="preview">
                     <StoryPreviewTab
                        title={watch("title")}
                        content={watch("content")}
                        watchThemes={watch("themes")}
                        watchAgeGroup={watch("ageGroup")}
                        availableThemes={availableThemes}
                        illustrations={illustrations}
                        getImageSrc={getImageSrc}
                        darkMode={darkMode}
                     />
                  </TabsContent>
                </Tabs>
              </div>

              <div
                className={`rounded-xl shadow-sm p-6 h-fit ${
                  darkMode
                    ? "dark:bg-gray-800 dark:text-gray-100 bg-white text-gray-900"
                    : "bg-white text-gray-900"
                }`}
              >
                <h2 className="text-xl font-bold text-story-purple-800 mb-4">
                  {t("create.storyDetails")}
                </h2>
                <StorySettings
                  availableThemes={memoizedAvailableThemes}
                  setAvailableThemes={() => {}}
                  weeklyThemes={weeklyThemes}
                  sortedDayOfWeekOptions={sortedDayOfWeekOptions}
                  story={defaultStoryForSetting}
                  availableSeries={availableSeries}
                />

                <Button
                  type="submit"
                  className="w-full bg-story-purple hover:bg-story-purple-600 mt-6"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t("create.save")}
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
    </PageLayout>
  );
};

export default CreateStoryPage;