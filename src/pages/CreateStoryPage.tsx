import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { i18n } from "@/lib/i18n";
import { truncateText } from "@/lib/utils";
import PageLayout from "@/components/Layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, Book, Paintbrush, Wand2 } from "lucide-react";
import { toast } from "sonner";
import StorySettings from "@/components/Story/StorySettings";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema, FormValues } from "@/components/Story/StoryEditor/formSchema";
import { AgeGroup, Illustration, Story } from "@/types/Story";
import { format } from 'date-fns';
import { getDayOrder } from "@/utils/dayUtils";
import useDarkMode from "@/hooks/useDarkMode";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import EditorSaveBar from "@/components/Story/StoryEditor/EditorSaveBar";
import { SelectedTheme } from "@/components/Theme/ThemeSelect";

// Shared Components
import StoryContent from "@/components/Story/StoryEditor/StoryContent";
import StoryIllustrations from "@/components/Story/StoryEditor/StoryIllustrations";
// Preview Tab remains from CreateStory for now as it's simple display
import StoryPreviewTab from "@/components/Story/CreateStory/StoryPreviewTab";

import { storyApi } from "@/api/stories.api";
import { systemApi } from "@/api/system.api";
import { useThemes, useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { Theme, WeeklyTheme } from "@/types/Theme";
import { APP_ROUTES } from "@/constants";
import { currentIsoWeek } from "@/utils/weekUtils";



const CreateStoryPage = () => {
  const { t } = i18n;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("write");
  const { data: availableThemes = [] } = useThemes();
  const { data: weeklyThemesQuery = [] } = useWeeklyThemes();
  const weeklyThemes = weeklyThemesQuery as WeeklyTheme[];
  const { data: availableSeries = [] } = useSeries();

  const darkMode = useDarkMode();
  
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
      // Current week by default (the field is required)
      weekNumber: String(currentIsoWeek().week),
      seriesName: "",
      version: 1
    },
  });

  const { handleSubmit, watch, formState: { isDirty, isSubmitting } } = methods;

  // Leaving loses the text, the uploaded illustrations, or interrupts a running generation
  const { dialog: unsavedChangesDialog, allowNavigation } = useUnsavedChangesGuard(isDirty || illustrations.length > 0);


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
      themes: data.themes.map(({ id, isPrimary }) => ({ id, isPrimary } as unknown as Theme)),
      age_group: data.ageGroup as AgeGroup,
      locale: data.language,
      day_order: getDayOrder(data.dayOfWeek),
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
      const response = await storyApi.create(payload);
      const newStory = response;
      
      toast.success(t("create.success.storyCreated"));
      if (newStory.aliasSeries) toast.warning(t("story.aliasCreated", { series: newStory.aliasSeries.name }));
      allowNavigation();
      navigate(APP_ROUTES.STORY_DETAIL(newStory.id));

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
        const res = await systemApi.uploadImage(formData);
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
        toast.error((err as Error)?.message || t("create.error.failedToUploadImage"));
      }
  };

  const deleteIllustration = async (illustrationId: string) => {
      // For Create Mode: Just remove from local state
      setIllustrations(prev => prev.filter(img => img.id !== illustrationId));
      toast.success(t('create.illustrate.success.imageDeleted'));
  };

  const reorderIllustrations = (orderedIds: string[]) => {
      // For Create Mode: reorder local state, positions are assigned on save
      setIllustrations(prev => orderedIds
          .map(illustrationId => prev.find(img => img.id === illustrationId))
          .filter((img): img is Illustration => Boolean(img)));
  };

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

  const save = handleSubmit(onSubmit);
  useSaveShortcut(() => void save(), !isSubmitting);

  const panelClass = "rounded-xl border border-white/20 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40 md:p-6";
  const tabClass = "flex items-center data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700";

  return (
    <PageLayout>
        <FormProvider {...methods}>
          <form onSubmit={save}>
            <EditorSaveBar
              title={t("create.title")}
              dirty={isDirty || illustrations.length > 0}
              saving={isSubmitting}
              onBack={() => navigate(-1)}
              saveLabel={t("create.save")}
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
              <div className="min-w-0 space-y-6">
                {/* AI generation runs on the server as jobs: it has its own page */}
                <p className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-4 py-2 text-sm text-indigo-900 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                  <Wand2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {t("editor.generateHint")}
                  <Link to={APP_ROUTES.GENERATION} className="font-semibold underline">{t("generation.open")} →</Link>
                </p>

                <div className={panelClass}>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-6 bg-white/50 dark:bg-slate-800/50 w-full justify-start">
                      <TabsTrigger value="write" className={tabClass}>
                        <PenLine className="h-4 w-4 mr-1" />
                        {t("create.tabs.write")}
                      </TabsTrigger>
                      <TabsTrigger value="preview" className={tabClass}>
                        <Book className="h-4 w-4 mr-1" />
                        {t("create.tabs.preview")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="write">
                      <StoryContent images={illustrations.map((image) => ({ src: getImageSrc(image) ?? "", alt: image.filename })).filter((image) => image.src)} />
                    </TabsContent>

                    <TabsContent value="preview">
                      <StoryPreviewTab
                        title={watch("title")}
                        content={watch("content")}
                        watchThemes={watch("themes") as SelectedTheme[]}
                        watchAgeGroup={watch("ageGroup")}
                        availableThemes={availableThemes}
                        illustrations={illustrations}
                        getImageSrc={getImageSrc}
                        darkMode={darkMode}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <section aria-labelledby="create-illustrations" className={panelClass}>
                  <h2 id="create-illustrations" className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <Paintbrush aria-hidden="true" className="h-5 w-5 text-story-purple-600 dark:text-story-purple-300" />
                    {t("create.tabs.illustrate")}
                  </h2>
                  <StoryIllustrations
                    illustrations={illustrations}
                    addIllustrationToBackend={addIllustrationToBackend}
                    deleteIllustration={deleteIllustration}
                    reorderIllustrations={reorderIllustrations}
                  />
                </section>
              </div>

              <aside>
                <StorySettings
                  availableThemes={availableThemes}
                  weeklyThemes={weeklyThemes}
                  availableSeries={availableSeries}
                />
              </aside>
            </div>
          </form>
        </FormProvider>
        {unsavedChangesDialog}
    </PageLayout>
  );
};

export default CreateStoryPage;
