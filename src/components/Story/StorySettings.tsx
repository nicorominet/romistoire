import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { CalendarDays, Tags } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAgeGroupColor } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { AGE_GROUPS } from "@/types/Story";
import { Theme, WeeklyTheme } from "@/types/Theme";
import { Series } from "@/types/Series";
import { SeriesSelector } from "@/components/Story/SeriesSelector";
import { ThemeMultiSelect, SelectedTheme } from "@/components/Theme/ThemeSelect";
import { useThemeMutations } from "@/hooks/useThemes";
import { MAX_ISO_WEEKS } from "@/utils/weekUtils";
import { DAY_NAMES_EN } from "@/utils/dayUtils";
import SlotConflictNotice from "@/components/Story/StoryEditor/SlotConflictNotice";

const STORY_LANGUAGES = ["fr", "en"] as const;
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface StorySettingsProps {
  availableThemes: Theme[];
  weeklyThemes: WeeklyTheme[];
  availableSeries: Series[];
  /** Edited story (none when creating): never a slot conflict with itself */
  storyId?: string;
  disabled?: boolean;
}

const triggerClass = "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";

const Group = ({ icon: Icon, title, children }: { icon: typeof Tags; title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4 rounded-xl border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/50">
    <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
      <Icon aria-hidden="true" className="h-4 w-4 text-story-purple-600 dark:text-story-purple-300" />
      {title}
    </legend>
    {children}
  </fieldset>
);

/**
 * StorySettings Component
 *
 * Settings of a story (edit and create pages): where it sits in the program (week, day, age, with the
 * slot check), then how it is classified (series, language, tags).
 */
const StorySettings: React.FC<StorySettingsProps> = ({
  availableThemes,
  weeklyThemes,
  availableSeries,
  storyId,
  disabled = false,
}) => {
  const { t } = i18n;
  const { control, setValue } = useFormContext();
  const { createTheme } = useThemeMutations();

  const handleCreateTheme = async (name: string): Promise<Theme | void> => {
    try {
      const theme = await createTheme.mutateAsync({ name });
      if (theme.existing) toast.info(t("themes.alreadyExists", { name: theme.name }));
      return theme;
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div className="space-y-4">
      <Group icon={CalendarDays} title={t("editor.sections.program")}>
        <FormField
          control={control}
          name="weekNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-gray-100">{t("create.weekNumber")}</FormLabel>
              <FormControl>
                {/* Radix Select sends "" when the form is reset: ignore it, or the field would be emptied */}
                <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value) field.onChange(value); }}>
                  <SelectTrigger ref={field.ref} className={triggerClass}>
                    <SelectValue placeholder={t("create.selectWeekNumber")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: MAX_ISO_WEEKS }, (_, i) => i + 1).map((week) => (
                      <SelectItem key={week} value={week.toString()}>
                        {week} - {weeklyThemes.find((theme) => theme.week_number === week)?.theme_name || t("common.noTheme")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="dayOfWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.dayOfWeek")}</FormLabel>
                <FormControl>
                  <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value) field.onChange(value); }}>
                    <SelectTrigger ref={field.ref} className={triggerClass}>
                      <SelectValue placeholder={t("create.selectDayOfWeek")} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Always in week order */}
                      {DAY_NAMES_EN.map((day, index) => (
                        <SelectItem key={day} value={day}>{t(`days.${DAY_KEYS[index]}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="ageGroup"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.ageGroup")}</FormLabel>
                <FormControl>
                  <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value) field.onChange(value); }}>
                    <SelectTrigger ref={field.ref} className={triggerClass}>
                      <SelectValue placeholder={t("story.selectAgeGroup")} />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUPS.map((ageGroup) => (
                        <SelectItem key={ageGroup} value={ageGroup} className={getAgeGroupColor(ageGroup)}>
                          {t(`ages.${ageGroup}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <SlotConflictNotice storyId={storyId} />
      </Group>

      <Group icon={Tags} title={t("editor.sections.classification")}>
        <FormField
          control={control}
          name="seriesName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.detail.series")}</FormLabel>
              <FormControl>
                <SeriesSelector
                  series={availableSeries}
                  value={field.value}
                  disabled={disabled}
                  onChange={(value) => { setValue("seriesName", value); field.onChange(value); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.language")}</FormLabel>
              <FormControl>
                <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value) field.onChange(value); }}>
                  <SelectTrigger ref={field.ref} className={triggerClass}>
                    <SelectValue placeholder={t("story.languagePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STORY_LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>{t(`languages.${language}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="themes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.themes")}</FormLabel>
              <FormControl>
                <ThemeMultiSelect
                  themes={availableThemes}
                  value={(field.value || []) as SelectedTheme[]}
                  disabled={disabled}
                  onChange={(value) => setValue("themes", value, { shouldDirty: true, shouldValidate: true })}
                  onCreate={handleCreateTheme}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Group>
    </div>
  );
};

export default StorySettings;
