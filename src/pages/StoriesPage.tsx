import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { i18n } from '@/lib/i18n';
import { Story, AgeGroup } from '@/types/Story';
import { Theme, WeeklyTheme } from '@/types/Theme';
import { Series } from '@/types/Series';
import PageLayout from '@/components/Layout/PageLayout';
import PDFExport from '@/components/Common/PDFExport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Book, FileText } from 'lucide-react';
import 'flag-icons/css/flag-icons.min.css';
import { APP_ROUTES } from '@/constants';

// New Components
import StoriesHeader from '@/components/Story/StoriesList/StoriesHeader';
import StoriesSearch from '@/components/Story/StoriesList/StoriesSearch';
import StoriesListGrid from '@/components/Story/StoriesList/StoriesGrid';

// Hooks
import { useInfiniteStories } from '@/hooks/useStories';
import { useThemes, useWeeklyThemes } from '@/hooks/useThemes';
import { useSeries } from '@/hooks/useSeries';

const { t } = i18n;

const StoriesPage = (): JSX.Element => {
  const navigate = useNavigate();
  
  // Filters live in the URL (single source of truth): back/forward, reload and shared links keep them.
  // 'all' (or a missing param) means "no filter".
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = (key: string) => searchParams.get(key) || 'all';
  const setFilter = useCallback((key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const selectedTheme = filterParam('theme');
  const selectedSeries = filterParam('seriesId');
  const selectedAgeGroup = filterParam('ageGroup') as AgeGroup | 'all';
  const weekNumberParam = parseInt(searchParams.get('weekNumber') || '', 10);
  const selectedWeekNumber = Number.isNaN(weekNumberParam) ? null : weekNumberParam;
  const selectedDayOfWeek = filterParam('dayOfWeek');
  const hasImage = filterParam('hasImage');
  const hasAudio = filterParam('hasAudio');
  const selectedSource = filterParam('source');
  const selectedEditStatus = filterParam('editStatus');
  const selectedReviewStatus = filterParam('reviewStatus');
  // Stories of one mass generation job (link from the Generation page)
  const generationJobId = searchParams.get('generationJobId') || '';
  const debouncedSearchTerm = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState<string>(debouncedSearchTerm);

  // Computed Params for Query
  const queryParams = useMemo(() => ({
      limit: 12, // Page size
      // locale: undefined, // Fetch all locales
      theme: selectedTheme !== 'all' ? selectedTheme : '',
      ageGroup: selectedAgeGroup,
      weekNumber: selectedWeekNumber?.toString() || '',
      dayOfWeek: selectedDayOfWeek !== 'all' ? selectedDayOfWeek : '',
      hasImage: hasImage !== 'all' ? hasImage : '',
      hasAudio: hasAudio !== 'all' ? hasAudio : '',
      seriesId: selectedSeries !== 'all' ? selectedSeries : '',
      source: selectedSource !== 'all' ? selectedSource : '',
      editStatus: selectedEditStatus !== 'all' ? selectedEditStatus : '',
      reviewStatus: selectedReviewStatus !== 'all' ? selectedReviewStatus : '',
      generationJobId,
      search: debouncedSearchTerm
  }), [selectedTheme, selectedAgeGroup, selectedWeekNumber, selectedDayOfWeek, hasImage, hasAudio, selectedSeries, selectedSource, selectedEditStatus, selectedReviewStatus, generationJobId, debouncedSearchTerm]);

  // React Query Hooks
  const { 
      data: storiesData, 
      fetchNextPage, 
      hasNextPage, 
      isFetchingNextPage, 
      isLoading: isStoriesLoading,
      error: storiesError
  } = useInfiniteStories(queryParams);

  const { data: themesData } = useThemes();
  const { data: weeklyThemesData } = useWeeklyThemes();
  const { data: seriesData } = useSeries();

  const themes = (themesData as Theme[]) || [];
  const weeklyThemes = (weeklyThemesData as WeeklyTheme[]) || [];
  const seriesList = (seriesData as Series[]) || [];

  const stories = useMemo(() => {
      return storiesData?.pages.flatMap(page => page.data) || [];
  }, [storiesData]);

  const totalStories = useMemo(() => {
      return storiesData?.pages[0]?.total || 0;
  }, [storiesData]);

  const weeklyThemesMap = useMemo(() => {
      const map: { [key: number]: string } = {};
      weeklyThemes.forEach((wt: WeeklyTheme) => {
          map[wt.week_number] = wt.theme_name;
      });
      return map;
  }, [weeklyThemes]);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
           fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Debounce search into the URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== debouncedSearchTerm) setFilter('search', searchTerm.trim() || null);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, debouncedSearchTerm, setFilter]);

  // Keep the input in sync when the URL changes (back/forward, reset)
  useEffect(() => {
    setSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const handleThemeChange = (theme: string) => setFilter('theme', theme);
  const handleAgeGroupChange = (ageGroup: AgeGroup | 'all') => setFilter('ageGroup', ageGroup);
  const handleWeekNumberChange = (weekNumber: number | null) => setFilter('weekNumber', weekNumber === null ? null : String(weekNumber));
  const handleDayOfWeekChange = (dayOfWeek: string) => setFilter('dayOfWeek', dayOfWeek);
  const handleHasImageChange = (value: string) => setFilter('hasImage', value);
  const handleHasAudioChange = (value: string) => setFilter('hasAudio', value);
  const handleSeriesChange = (value: string) => setFilter('seriesId', value);
  const handleSourceChange = (value: string) => setFilter('source', value);
  const handleEditStatusChange = (value: string) => setFilter('editStatus', value);
  const handleReviewStatusChange = (value: string) => setFilter('reviewStatus', value);
  const handleSearch = () => setFilter('search', searchTerm.trim() || null);
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleCreateStory = () => navigate(APP_ROUTES.CREATE_STORY);

  const groupedStories = useMemo(() => {
    return stories.filter(Boolean).reduce((acc, story) => {
      if (!story) return acc; // Safety check
      if (!acc[story.locale]) {
        acc[story.locale] = [];
      }
      acc[story.locale].push(story);
      return acc;
    }, {} as { [key: string]: Story[] });
  }, [stories]);

  
  return (
    <PageLayout>
        <div className="flex flex-col gap-8">
          <StoriesHeader
            totalStories={totalStories}
            handleCreateStory={handleCreateStory}
          />
          <StoriesSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            selectedTheme={selectedTheme}
            handleThemeChange={handleThemeChange}
            themes={themes}
            weeklyThemesMap={weeklyThemesMap}
            selectedAgeGroup={selectedAgeGroup}
            handleAgeGroupChange={handleAgeGroupChange}
            selectedWeekNumber={selectedWeekNumber}
            handleWeekNumberChange={handleWeekNumberChange}
            selectedDayOfWeek={selectedDayOfWeek}
            handleDayOfWeekChange={handleDayOfWeekChange}
            hasImage={hasImage}
            handleHasImageChange={handleHasImageChange}
            hasAudio={hasAudio}
            handleHasAudioChange={handleHasAudioChange}
            series={seriesList}
            selectedSeries={selectedSeries}
            handleSeriesChange={handleSeriesChange}
            selectedSource={selectedSource}
            handleSourceChange={handleSourceChange}
            selectedEditStatus={selectedEditStatus}
            handleEditStatusChange={handleEditStatusChange}
            selectedReviewStatus={selectedReviewStatus}
            handleReviewStatusChange={handleReviewStatusChange}
            handleResetFilters={handleResetFilters}
          />
          {generationJobId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
              <span>{t('generation.library.jobFilter')}</span>
              <span className="flex gap-3">
                <Link to={`${APP_ROUTES.GENERATION}?tab=jobs&job=${generationJobId}`} className="underline">{t('generation.library.openJob')}</Link>
                <button type="button" className="underline" onClick={() => setFilter('generationJobId', null)}>{t('generation.library.clearJob')}</button>
              </span>
            </div>
          )}
          <Tabs defaultValue="grid" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="grid" className="flex items-center gap-1">
                <Book className="h-4 w-4" />
                {t('stories.title')}
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {t('pdf.export')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="grid">
              <StoriesListGrid
                loading={isStoriesLoading} 
                error={storiesError ? (storiesError as Error).message : null}
                stories={stories}
                groupedStories={groupedStories}
                observerRef={observerTarget}
                hasMore={!!hasNextPage}
                handleCreateStory={handleCreateStory}
              />
              {isFetchingNextPage && <div className="text-center py-4">{t('common.loading')}</div>}
            </TabsContent>
            <TabsContent value="export">
              <PDFExport availableStories={stories} storyQuery={queryParams} />
            </TabsContent>
          </Tabs>
        </div>
    </PageLayout>
  );
};

export default StoriesPage;
