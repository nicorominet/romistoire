import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getAgeGroupColor, formatDate } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { Story, AGE_GROUPS } from "@/types/Story";
import { useEffect, useState, useMemo } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Series } from "@/types/Series";
import { SeriesSelector } from "@/components/Story/SeriesSelector";

interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

interface StorySettingsProps {
  availableThemes: Theme[];
  setAvailableThemes: React.Dispatch<React.SetStateAction<Theme[]>>;
  weeklyThemes: { week_number: number; theme_name: string }[];
  sortedDayOfWeekOptions: { value: string; label: string }[];
  story: Story;
  availableSeries: Series[];
}

const StorySettings: React.FC<StorySettingsProps> = ({
  availableThemes,
  setAvailableThemes,
  weeklyThemes,
  sortedDayOfWeekOptions,
  story,
  availableSeries,
}) => {
  const { t } = i18n;
  const { control, setValue, watch } = useFormContext();
  const selectedThemeIds = watch("themes") || [];
  const [searchTheme, setSearchTheme] = useState("");

  const filteredThemes = useMemo(() => {
    return availableThemes.filter(theme =>
    theme.name.toLowerCase().includes(searchTheme.toLowerCase()) &&
    !selectedThemeIds.includes(theme.id)
  );
  }, [availableThemes, searchTheme, selectedThemeIds]);

  const handleThemeRemove = (themeId: string) => {
    const newThemes = selectedThemeIds.filter((id: string) => id !== themeId);
    setValue("themes", newThemes);
  };

  const handleThemeSelect = (themeId: string) => {
    const newThemes = [...selectedThemeIds, themeId];
    setValue("themes", newThemes);
    setSearchTheme("");
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
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedThemeIds.map((themeId: string) => {
                  const theme = availableThemes.find(t => t.id === themeId);
                  if (!theme) return null;
                  return (
                    <Badge
                      key={theme.id}
                      style={{ backgroundColor: theme.color }}
                      className="flex items-center gap-1"
                    >
                      {theme.name}
                      <button
                        type="button"
                        onClick={() => handleThemeRemove(theme.id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Command className="border rounded-md">
                <CommandInput
                  placeholder={t("story.searchThemes")}
                  value={searchTheme}
                  onValueChange={setSearchTheme}
                  className="bg-white dark:bg-gray-700"
                />
                <CommandEmpty>{t("story.noThemesFound")}</CommandEmpty>
                <CommandGroup className="max-h-48 overflow-auto">
                  {filteredThemes.map((theme) => (
                    <CommandItem
                      key={theme.id}
                      value={theme.name}
                      onSelect={() => handleThemeSelect(theme.id)}
                    >
                      <Badge style={{ backgroundColor: theme.color }}>
                        {theme.name}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </div>
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
              <Input
                placeholder={t("story.languagePlaceholder")}
                {...field}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                onChange={(e) => {
                  setValue("language", e.target.value);
                  field.onChange(e);
                }}
              />
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
                onValueChange={(value) => {
                  setValue("dayOfWeek", value);
                  field.onChange(value);
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
                onValueChange={(value) => {
                  setValue("weekNumber", value);
                  field.onChange(value);
                }}
              >
                <SelectTrigger ref={field.ref} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder={t("create.selectWeekNumber")} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
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
