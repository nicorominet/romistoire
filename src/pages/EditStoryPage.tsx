import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/constants";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { i18n } from "@/lib/i18n";
import { ArrowLeft, Image, Info } from "lucide-react";
import { toast } from "sonner";
import StoryIllustrations from "@/components/Story/StoryEditor/StoryIllustrations";
import StorySettings from "@/components/Story/StorySettings";
import { formSchema, FormValues } from "@/components/Story/StoryEditor/formSchema";
import useStoryData from "@/hooks/useStoryData";
import StoryContent from "@/components/Story/StoryEditor/StoryContent";
import EditorSaveBar from "@/components/Story/StoryEditor/EditorSaveBar";
import VersionHistory from "@/components/Story/EditStory/VersionHistory";
import { Theme } from "@/types/Theme";
import { Series } from "@/types/Series";
import { Story, StoryVersion, AgeGroup } from "@/types/Story";
import { storyApi } from "@/api/stories.api";
import { useThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { DAY_NAMES_EN, getDayOrder } from "@/utils/dayUtils";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import { withOnePrimary } from "@/components/Theme/ThemeSelect";
import { StoryTheme } from "@/types/Theme";

const panelClass = "rounded-xl border border-white/20 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40 md:p-6";

/** Form values of a loaded story. */
const formValuesOf = (story: Story): FormValues => ({
  title: story.title,
  content: story.content,
  themes: withOnePrimary(story.themes.map((theme) => ({ id: theme.id, isPrimary: Boolean((theme as StoryTheme).isPrimary) }))),
  ageGroup: story.age_group as AgeGroup,
  // Legacy free-text locales ("fr-FR", typos) fall back to French; the select only offers fr / en
  language: story.locale === "en" ? "en" : "fr",
  dayOfWeek: DAY_NAMES_EN[story.day_order - 1] || "",
  weekNumber: story.week_number.toString(),
  seriesName: story.series_name || "",
  version: story.version,
});

/**
 * EditStoryPage Component
 *
 * Writing first (title, text, then illustrations), the settings beside; the save bar stays in sight
 * (Ctrl+S too) and says when changes are unsaved. Earlier versions can be read and restored.
 */
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
  const [formInitialised, setFormInitialised] = useState(false);
  const [versions, setVersions] = useState<StoryVersion[]>([]);

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
  const { isDirty, dirtyFields } = form.formState;

  const { dialog: unsavedChangesDialog, allowNavigation } = useUnsavedChangesGuard(isDirty || saving);

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
      form.reset(formValuesOf(story));
      setFormInitialised(true);
    }
  }, [story, formInitialised, form]);

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

  const save = form.handleSubmit(onSubmit);
  useSaveShortcut(() => void save(), !saving && formInitialised);

  const handleBack = () => {
    navigate(APP_ROUTES.STORY_DETAIL(id!));
  };

  const handleDiscard = () => {
    if (story) form.reset(formValuesOf(story));
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!beginSave()) return;
    try {
      await storyApi.restoreVersion(id!, versionId);

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

  // What saving will also do, said before it happens (the server removes the audio when the text changes)
  const notes = [
    story.review_status === "to_review" && t("editor.notes.review"),
    story.audio_path && (dirtyFields.title || dirtyFields.content) && t("story.audio.willBeDeleted"),
  ].filter(Boolean) as string[];

  return (
    <PageLayout>
        <FormProvider {...form}>
          <form onSubmit={save}>
            <EditorSaveBar
              title={t("editor.editTitle", { title: form.watch("title") || story.title })}
              dirty={isDirty}
              saving={saving}
              onBack={handleBack}
              onDiscard={handleDiscard}
            />

            <fieldset disabled={saving} aria-busy={saving} className="min-w-0 border-0 p-0">
            <div className={`grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] ${saving ? "pointer-events-none opacity-70" : ""}`}>
              <div className="min-w-0 space-y-6">
                <div className={panelClass}>
                  <StoryContent
                    disabled={saving}
                    images={illustrations.filter((image) => image.image_path).map((image) => ({ src: `/${image.image_path!.replace(/\\/g, "/")}`, alt: image.filename }))}
                  />
                </div>

                <section aria-labelledby="edit-illustrations" className={panelClass}>
                  <h2 id="edit-illustrations" className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <Image aria-hidden="true" className="h-5 w-5 text-story-purple-600 dark:text-story-purple-300" />
                    {t("story.illustrations")}
                  </h2>
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t("story.illustrationsSavedImmediately")}</p>
                  <StoryIllustrations
                    illustrations={illustrations}
                    addIllustrationToBackend={addIllustrationToBackend}
                    deleteIllustration={deleteIllustration}
                    reorderIllustrations={reorderIllustrations}
                    illustrationPrompt={story.illustration_prompt}
                    disabled={saving}
                  />
                </section>
              </div>

              {/* Not sticky: taller than the screen with the history; the save bar is what stays in sight */}
              <aside className="space-y-4">
                <StorySettings
                  availableThemes={availableThemes}
                  weeklyThemes={weeklyThemes}
                  availableSeries={availableSeries as unknown as Series[]}
                  storyId={story.id}
                  disabled={saving}
                />

                {notes.length > 0 && (
                  <ul className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200">
                    {notes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                )}

                <VersionHistory
                  versions={versions}
                  current={{ title: story.title, content: story.content, ageGroup: String(story.age_group), themes: story.themes.map((theme) => theme.name) }}
                  onRestore={handleRestoreVersion}
                  saving={saving}
                  hasUnsavedChanges={isDirty}
                />
              </aside>
            </div>
            </fieldset>
          </form>
        </FormProvider>
        {unsavedChangesDialog}
    </PageLayout>
  );
};

export default EditStoryPage;
