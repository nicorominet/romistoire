import { i18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgeGroup, AGE_GROUPS } from "@/types/Story";
import { Series } from "@/types/Series";

interface StoriesSearchProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: () => void;
  selectedTheme: string;
  handleThemeChange: (theme: string) => void;
  themes: { id: string; name: string }[];
  weeklyThemeId: string | null;
  weeklyThemeName: string | null;
  weeklyThemesMap: { [week: number]: string };
  selectedAgeGroup: AgeGroup;
  handleAgeGroupChange: (ageGroup: AgeGroup) => void;
  selectedWeekNumber: number | null;
  handleWeekNumberChange: (week: number | null) => void;
  selectedDayOfWeek: string;
  handleDayOfWeekChange: (day: string) => void;
  hasImage: string;
  handleHasImageChange: (value: string) => void;
  series: Series[];
  selectedSeries: string;
  handleSeriesChange: (seriesId: string) => void;
}

const StoriesSearch = ({
  searchTerm,
  setSearchTerm,
  handleSearch,
  selectedTheme,
  handleThemeChange,
  themes,
  weeklyThemeId,
  weeklyThemeName,
  weeklyThemesMap,
  selectedAgeGroup,
  handleAgeGroupChange,
  selectedWeekNumber,
  handleWeekNumberChange,
  selectedDayOfWeek,
  handleDayOfWeekChange,
  hasImage,
  handleHasImageChange,
  series,
  selectedSeries,
  handleSeriesChange
}: StoriesSearchProps) => {
  const { t } = i18n;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('stories.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label={t('stories.searchStories')}
            />
          </div>
          <Select
            value={selectedTheme}
            onValueChange={handleThemeChange}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('stories.allThemes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stories.allThemes')}</SelectItem>
              {weeklyThemeId && weeklyThemeName && (
                 <SelectItem value={weeklyThemeId} className="font-bold text-story-purple-800 border-b">
                   ⭐ {weeklyThemeName}
                 </SelectItem>
              )}
              {themes.map((theme: any) => (
                <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedAgeGroup}
            onValueChange={handleAgeGroupChange}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('stories.allAges')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stories.allAges')}</SelectItem>
              {AGE_GROUPS.map((age) => (
                 <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedWeekNumber?.toString() || 'all'}
            onValueChange={(value) => handleWeekNumberChange(value === 'all' ? null : parseInt(value, 10))}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t('stories.allWeeks')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stories.allWeeks')}</SelectItem>
              {Array.from({ length: 104 }, (_, i) => i + 1).map(week => (
                <SelectItem key={week} value={week.toString()}>
                  {week} {weeklyThemesMap && weeklyThemesMap[week] ? `- ${weeklyThemesMap[week]}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedDayOfWeek?.toString() || 'all'}
            onValueChange={(value) => handleDayOfWeekChange(value === 'all' ? 'all' : value)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('stories.allDays')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stories.allDays')}</SelectItem>
              <SelectItem value="1">{t('days.monday')}</SelectItem>
              <SelectItem value="2">{t('days.tuesday')}</SelectItem>
              <SelectItem value="3">{t('days.wednesday')}</SelectItem>
              <SelectItem value="4">{t('days.thursday')}</SelectItem>
              <SelectItem value="5">{t('days.friday')}</SelectItem>
              <SelectItem value="6">{t('days.saturday')}</SelectItem>
              <SelectItem value="0">{t('days.sunday')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={hasImage}
            onValueChange={handleHasImageChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('stories.allImages')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stories.allImages')}</SelectItem>
              <SelectItem value="yes">{t('stories.withImage')}</SelectItem>
              <SelectItem value="no">{t('stories.withoutImage')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} variant="secondary" aria-label={t('common.search')}>
            {t('common.search')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoriesSearch;
