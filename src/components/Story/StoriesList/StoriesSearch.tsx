import { useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, Search, X, RotateCcw } from "lucide-react";
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
  selectedAgeGroup: AgeGroup | 'all';
  handleAgeGroupChange: (ageGroup: AgeGroup | 'all') => void;
  selectedWeekNumber: number | null;
  handleWeekNumberChange: (week: number | null) => void;
  selectedDayOfWeek: string;
  handleDayOfWeekChange: (day: string) => void;
  hasImage: string;
  handleHasImageChange: (value: string) => void;
  hasAudio: string;
  handleHasAudioChange: (value: string) => void;
  series: Series[];
  selectedSeries: string;
  handleSeriesChange: (seriesId: string) => void;
  selectedSource: string;
  handleSourceChange: (source: string) => void;
  selectedEditStatus: string;
  handleEditStatusChange: (status: string) => void;
  handleResetFilters: () => void;
  disableSeriesFilter?: boolean;
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
  hasAudio,
  handleHasAudioChange,
  series,
  selectedSeries,
  handleSeriesChange,
  selectedSource,
  handleSourceChange,
  selectedEditStatus,
  handleEditStatusChange,
  handleResetFilters,
  disableSeriesFilter = false
}: StoriesSearchProps) => {
  const { t } = i18n;
  const [showFilters, setShowFilters] = useState(false);

  // Check if any filter is active to show a badge or keep expanded
  const hasActiveFilters = 
    selectedTheme !== 'all' || 
    (selectedAgeGroup as string) !== 'all' || 
    selectedSeries !== 'all' || 
    selectedWeekNumber !== null || 
    selectedDayOfWeek !== 'all' || 
    hasImage !== 'all' || 
    hasAudio !== 'all' || 
    selectedSource !== 'all' || 
    selectedEditStatus !== 'all';

  return (
    <Card className="w-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          {/* Top Row: Search and Action */}
          <div className="flex flex-col sm:flex-row gap-2 w-full">
             <div className="relative flex-1">
                <Input
                  placeholder={t('stories.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-10 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-story-purple-400"
                  aria-label={t('stories.searchStories')}
                />
                <span className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={20} />
                </span>
                {searchTerm && (
                  <button 
                    onClick={() => { setSearchTerm(''); handleSearch(); }}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
             </div>
             <div className="flex gap-2">
                <Button 
                  onClick={() => setShowFilters(!showFilters)} 
                  variant="outline" 
                  className={`flex gap-2 items-center border-story-purple-200 hover:bg-story-purple-50 ${showFilters || hasActiveFilters ? 'bg-story-purple-50 border-story-purple-400 text-story-purple-700' : ''}`}
                >
                  <SlidersHorizontal size={18} />
                  <span className="hidden sm:inline">{t('filters.title')}</span>
                  {hasActiveFilters && !showFilters && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-story-purple-600 text-[10px] text-white">
                      !
                    </span>
                  )}
                  {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleResetFilters}
                    title={t('filters.reset')}
                    className="text-gray-400 hover:text-story-purple-600"
                  >
                    <RotateCcw size={18} />
                  </Button>
                )}
                <Button onClick={handleSearch} className="bg-story-purple-600 hover:bg-story-purple-700 text-white min-w-[100px]">
                  {t('common.search')}
                </Button>
             </div>
          </div>

          {/* Collapsible Filters Container */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-2 border-t border-white/20 dark:border-white/10 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select value={selectedTheme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
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

              <Select value={selectedAgeGroup} onValueChange={handleAgeGroupChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
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
                value={selectedSeries}
                onValueChange={handleSeriesChange}
                disabled={disableSeriesFilter}
              >
                <SelectTrigger className={`w-full bg-white/50 dark:bg-slate-800/50 ${disableSeriesFilter ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
                  <SelectValue placeholder={t('story.series')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('story.allSeries')}</SelectItem>
                  {series.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedWeekNumber?.toString() || 'all'}
                onValueChange={(value) => handleWeekNumberChange(value === 'all' ? null : parseInt(value, 10))}
              >
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
                  <SelectValue placeholder={t('stories.allWeeks')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('stories.allWeeks')}</SelectItem>
                  {Array.from({ length: 104 }, (_, i) => i + 1).map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      {t("timeline.weekNumber", { number: week })} {weeklyThemesMap && weeklyThemesMap[week] ? `- ${weeklyThemesMap[week]}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedDayOfWeek?.toString() || 'all'}
                onValueChange={(value) => handleDayOfWeekChange(value === 'all' ? 'all' : value)}
              >
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
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
                  <SelectItem value="7">{t('days.sunday')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={hasImage} onValueChange={handleHasImageChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
                  <SelectValue placeholder={t('stories.allImages')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('stories.allImages')}</SelectItem>
                  <SelectItem value="yes">{t('stories.withImage')}</SelectItem>
                  <SelectItem value="no">{t('stories.withoutImage')}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={hasAudio}
                onValueChange={handleHasAudioChange}
              >
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
                  <SelectValue placeholder={t('stories.allAudio')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('stories.allAudio')}</SelectItem>
                  <SelectItem value="yes">{t('stories.withAudio')}</SelectItem>
                  <SelectItem value="no">{t('stories.withoutAudio')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSource} onValueChange={handleSourceChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
                  <SelectValue placeholder={t('filters.allSources')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allSources')}</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="manual">{t('story.source.manual')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedEditStatus} onValueChange={handleEditStatusChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50">
                  <SelectValue placeholder={t('filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
                  <SelectItem value="original">{t('filters.original')}</SelectItem>
                  <SelectItem value="edited">{t('filters.edited')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      </CardContent>
    </Card>
  );
};

export default StoriesSearch;
