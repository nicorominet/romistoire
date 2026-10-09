import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAgeGroupColor, formatDate } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { Story, AGE_GROUPS } from "@/types/Story";
import { Theme, WeeklyTheme } from "@/types/Theme";
import { Series } from "@/types/Series";
import { SeriesSelector } from "@/components/Story/SeriesSelector";
import { ThemeMultiSelect, SelectedTheme } from "@/components/Theme/ThemeSelect";
import { useThemeMutations } from "@/hooks/useThemes";
import { MAX_ISO_WEEKS } from "@/utils/weekUtils";

const STORY_LANGUAGES = ["fr", "en"] as const;

interface StorySettingsProps {
  availableThemes: Theme[];
  weeklyThemes: WeeklyTheme[];
  sortedDayOfWeekOptions: { value: string; label: string }[];
  story: Story;
  availableSeries: Series[];
  disabled?: boolean;
}

const StorySettings: React.FC<StorySettingsProps> = ({
  availableThemes,
  weeklyThemes,
  sortedDayOfWeekOptions,
  story,
  availableSeries,
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
      <FormField
        control={control}
        name="seriesName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.series")}</FormLabel>
            <FormControl>
              <SeriesSelector
                series={availableSeries}
                value={field.value}
                disabled={disabled}
                onChange={(value) => {
                  setValue("seriesName", value);
                  field.onChange(value);
                }}
              />
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

      <FormField
        control={control}
        name="ageGroup"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.ageGroup")}</FormLabel>
            <FormControl>
              <Select
                value={field.value}
                disabled={disabled}
                onValueChange={(value) => {
                  setValue("ageGroup", value);
                  field.onChange(value);
                }}
              >
                <SelectTrigger ref={field.ref} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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

      <FormField
        control={control}
        name="language"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.language")}</FormLabel>
            <FormControl>
              <Select
                value={field.value}
                disabled={disabled}
                onValueChange={(value) => {
                  setValue("language", value as "fr" | "en");
                  field.onChange(value);
                }}
              >
                <SelectTrigger ref={field.ref} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder={t("story.languagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {STORY_LANGUAGES.map((language) => (
                    <SelectItem key={language} value={language}>
                      {t(`languages.${language}`)}
                    </SelectItem>
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
        name="dayOfWeek"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.dayOfWeek")}</FormLabel>
            <FormControl>
              <Select
                value={field.value}
                disabled={disabled}
                onValueChange={(value) => {
                  if (value) field.onChange(value);
                }}
              >
                <SelectTrigger ref={field.ref} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder={t("create.selectDayOfWeek")} />
                </SelectTrigger>
                <SelectContent>
                  {sortedDayOfWeekOptions.length > 0 ? (
                    sortedDayOfWeekOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="no-days">{t("common.noDaysAvailable")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="weekNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("create.weekNumber")}</FormLabel>
            <FormControl>
              <Select
                value={field.value}
                disabled={disabled}
                onValueChange={(value) => {
                  if (value) field.onChange(value);
                }}
              >
                <SelectTrigger ref={field.ref} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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

      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-1">{t("story.version")}</h3>
        <p className="text-sm text-gray-900 dark:text-gray-100">{story.version}</p>
      </div>
      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-1">{t("story.created")}</h3>
        <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(story.created_at)}</p>
      </div>
      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-1">{t("story.lastModified")}</h3>
        <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(story.modified_at)}</p>
      </div>
    </div>
  );
};

export default StorySettings;
