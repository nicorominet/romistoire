import { useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, Search, X, RotateCcw } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgeGroup, AGE_GROUPS } from "@/types/Story";
import { Series } from "@/types/Series";
import { Theme } from "@/types/Theme";
import { ThemeSelect } from "@/components/Theme/ThemeSelect";
import { MAX_ISO_WEEKS } from "@/utils/weekUtils";

interface StoriesSearchProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: () => void;
  selectedTheme: string;
  handleThemeChange: (theme: string) => void;
  themes: Theme[];
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
  /** Review filter: shown only when the page handles it */
  selectedReviewStatus?: string;
  handleReviewStatusChange?: (status: string) => void;
  handleResetFilters: () => void;
  disableSeriesFilter?: boolean;
  /** Language filter: shown only when the page handles it; a chip appears when it differs from its default */
  localeFilter?: { value: string; defaultValue: string; onChange: (locale: string) => void };
  /** Extra controls of the top row (sort, view), before the filters button */
  toolbar?: React.ReactNode;
}

interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

const StoriesSearch = ({
  searchTerm,
  setSearchTerm,
  handleSearch,
  selectedTheme,
  handleThemeChange,
  themes,
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
  selectedReviewStatus = 'all',
  handleReviewStatusChange,
  handleResetFilters,
  disableSeriesFilter = false,
  localeFilter,
  toolbar
}: StoriesSearchProps) => {
  const { t } = i18n;
  const [showFilters, setShowFilters] = useState(false);

  // Active filters, shown as removable chips under the search (no need to open the panel to see them)
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const activeFilters: ActiveFilter[] = [
    localeFilter && localeFilter.value !== localeFilter.defaultValue && {
      key: 'locale',
      label: localeFilter.value === 'all' ? t('stories.allLanguages') : t(`languages.${localeFilter.value}`),
      onRemove: () => localeFilter.onChange(localeFilter.defaultValue),
    },
    selectedTheme !== 'all' && {
      key: 'theme',
      label: themes.find((theme) => theme.id === selectedTheme)?.name ?? t('story.themes'),
      onRemove: () => handleThemeChange('all'),
    },
    (selectedAgeGroup as string) !== 'all' && { key: 'age', label: t(`ages.${selectedAgeGroup}`), onRemove: () => handleAgeGroupChange('all') },
    selectedSeries !== 'all' && !disableSeriesFilter && {
      key: 'series',
      label: series.find((s) => s.id === selectedSeries)?.name ?? t('story.series'),
      onRemove: () => handleSeriesChange('all'),
    },
    selectedWeekNumber !== null && {
      key: 'week',
      label: t('timeline.weekNumber', { number: selectedWeekNumber }),
      onRemove: () => handleWeekNumberChange(null),
    },
    selectedDayOfWeek !== 'all' && {
      key: 'day',
      label: t(`days.${days[Number(selectedDayOfWeek) - 1]}`),
      onRemove: () => handleDayOfWeekChange('all'),
    },
    hasImage !== 'all' && {
      key: 'image',
      label: hasImage === 'yes' ? t('stories.withImage') : t('stories.withoutImage'),
      onRemove: () => handleHasImageChange('all'),
    },
    hasAudio !== 'all' && {
      key: 'audio',
      label: hasAudio === 'yes' ? t('stories.withAudio') : t('stories.withoutAudio'),
      onRemove: () => handleHasAudioChange('all'),
    },
    selectedSource !== 'all' && {
      key: 'source',
      label: selectedSource === 'manual' ? t('story.source.manual') : selectedSource === 'ollama' ? 'Ollama' : 'Gemini',
      onRemove: () => handleSourceChange('all'),
    },
    selectedEditStatus !== 'all' && {
      key: 'edit',
      label: selectedEditStatus === 'edited' ? t('filters.edited') : t('filters.original'),
      onRemove: () => handleEditStatusChange('all'),
    },
    selectedReviewStatus !== 'all' && handleReviewStatusChange && {
      key: 'review',
      label: selectedReviewStatus === 'to_review' ? t('review.toReview') : t('review.validated'),
      onRemove: () => handleReviewStatusChange('all'),
    },
  ].filter(Boolean) as ActiveFilter[];
  const hasActiveFilters = activeFilters.length > 0;

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
             <div className="flex flex-wrap gap-2">
                {toolbar}
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  aria-expanded={showFilters}
                  className={`flex gap-2 items-center border-story-purple-200 hover:bg-story-purple-50 ${showFilters || hasActiveFilters ? 'bg-story-purple-50 border-story-purple-400 text-story-purple-700' : ''}`}
                >
                  <SlidersHorizontal size={18} />
                  <span className="hidden sm:inline">{t('filters.title')}</span>
                  {hasActiveFilters && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-story-purple-600 px-1 text-[11px] font-semibold text-white" aria-label={t('stories.filtersActive', { count: String(activeFilters.length) })}>
                      {activeFilters.length}
                    </span>
                  )}
                  {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
             </div>
          </div>

          {/* Active filters: one removable chip each */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map(({ key, label, onRemove }) => (
                <span key={key} className="inline-flex items-center gap-1 rounded-full border border-story-purple-200 bg-story-purple-50 py-0.5 pl-3 pr-1 text-sm text-story-purple-800 dark:border-story-purple-800 dark:bg-story-purple-900/30 dark:text-story-purple-200">
                  {label}
                  <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t('stories.removeFilter', { filter: label })}
                    className="rounded-full p-0.5 hover:bg-story-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400 dark:hover:bg-story-purple-800/50"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <button type="button" onClick={handleResetFilters} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-story-purple-700 hover:underline dark:text-gray-400">
                <RotateCcw size={14} />
                {t('stories.clearAll')}
              </button>
            </div>
          )}

          {/* Collapsible Filters Container */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-2 border-t border-white/20 dark:border-white/10 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ThemeSelect
                themes={themes}
                value={selectedTheme && selectedTheme !== 'all' ? selectedTheme : null}
                onChange={(themeId) => handleThemeChange(themeId ?? 'all')}
                placeholder={t('stories.allThemes')}
                clearLabel={t('stories.allThemes')}
                className="bg-white/50 dark:bg-slate-800/50"
              />

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
                  {Array.from({ length: MAX_ISO_WEEKS }, (_, i) => i + 1).map(week => (
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

              {localeFilter && (
              <Select value={localeFilter.value} onValueChange={localeFilter.onChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50" aria-label={t('stories.language')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">{t('languages.fr')}</SelectItem>
                  <SelectItem value="en">{t('languages.en')}</SelectItem>
                  <SelectItem value="all">{t('stories.allLanguages')}</SelectItem>
                </SelectContent>
              </Select>
              )}

              {handleReviewStatusChange && (
              <Select value={selectedReviewStatus} onValueChange={handleReviewStatusChange}>
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50" aria-label={t('review.filter')}>
                  <SelectValue placeholder={t('review.filter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('review.all')}</SelectItem>
                  <SelectItem value="to_review">{t('review.toReview')}</SelectItem>
                  <SelectItem value="validated">{t('review.validated')}</SelectItem>
                </SelectContent>
              </Select>
              )}
            </div>
          </div>
        </div>
      </div>
      </CardContent>
    </Card>
  );
};

export default StoriesSearch;
