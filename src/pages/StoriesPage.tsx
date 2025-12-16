import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { i18n } from '@/lib/i18n';
import { Story, AgeGroup } from '@/types/Story';
import { Theme } from '@/types/Theme';
import { Series } from '@/types/Series';
import PageLayout from '@/components/Layout/PageLayout';
import PDFExport from '@/components/Common/PDFExport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Book, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import 'flag-icons/css/flag-icons.min.css';
import useDarkMode from '@/hooks/useDarkMode';

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
  const location = useLocation();
  const { themeId } = useParams<{ themeId: string }>();
  const { toast } = useToast();
  const darkMode = useDarkMode(); // Kept for consistency if needed by children (though StoriesListGrid usually handles it)
  
  // Filter State
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>('' as AgeGroup);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('');
  const [hasImage, setHasImage] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  
  // Computed Params for Query
  const queryParams = useMemo(() => ({
      limit: 12, // Page size
      // locale: undefined, // Fetch all locales
      theme: selectedTheme,
      ageGroup: selectedAgeGroup,
      weekNumber: selectedWeekNumber?.toString() || '',
      dayOfWeek: selectedDayOfWeek,
      hasImage: hasImage !== 'all' ? hasImage : '',
      seriesId: selectedSeries !== 'all' ? selectedSeries : '',
      search: debouncedSearchTerm
  }), [selectedTheme, selectedAgeGroup, selectedWeekNumber, selectedDayOfWeek, hasImage, selectedSeries, debouncedSearchTerm]);

  // React Query Hooks
  const { 
      data: storiesData, 
      fetchNextPage, 
      hasNextPage, 
      isFetching, 
      isFetchingNextPage, 
      isLoading: isStoriesLoading,
      error: storiesError
  } = useInfiniteStories(queryParams);

  const { data: themesData } = useThemes();
  const { data: weeklyThemesData } = useWeeklyThemes();
  const { data: seriesData } = useSeries();

  const themes = (themesData as Theme[]) || [];
  const weeklyThemes = (weeklyThemesData as any[]) || [];
  const seriesList = (seriesData as Series[]) || [];

  const stories = useMemo(() => {
      return storiesData?.pages.flatMap(page => page.data) || [];
  }, [storiesData]);

  const totalStories = useMemo(() => {
      return storiesData?.pages[0]?.total || 0;
  }, [storiesData]);

  // Data processing for UI
  const themeColors = useMemo(() => {
     const colors: { [key: string]: string } = {};
     themes.forEach((t: Theme) => {
          if (t.id && t.color) colors[t.id] = t.color;
     });
     return colors;
  }, [themes]);

  const weeklyThemesMap = useMemo(() => {
      const map: { [key: number]: string } = {};
      weeklyThemes.forEach((wt: any) => {
          map[wt.week_number] = wt.theme_name;
      });
      return map;
  }, [weeklyThemes]);

  // Current Week Theme Logic
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };
  
  const [weeklyThemeDetails, setWeeklyThemeDetails] = useState<{id: string | null, name: string | null}>({ id: null, name: null });

  useEffect(() => {
      if (weeklyThemesMap && themes) {
          const currentWeek = getWeekNumber(new Date());
          const currentThemeName = weeklyThemesMap[currentWeek];
          if (currentThemeName) {
                const matchingTheme = themes.find((t: Theme) => t.name === currentThemeName);
                setWeeklyThemeDetails({
                    name: currentThemeName,
                    id: matchingTheme ? matchingTheme.id : null
                });
          }
      }
  }, [weeklyThemesMap, themes]);

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

  // Sync Filters with URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const themeParam = params.get('theme');
    const ageGroupParam = params.get('ageGroup') as AgeGroup;
    const weekNumberParam = params.get('weekNumber');
    const dayOfWeekParam = params.get('dayOfWeek');
    const hasImageParam = params.get('hasImage');

    if (themeParam) setSelectedTheme(themeParam);
    if (ageGroupParam) setSelectedAgeGroup(ageGroupParam);
    if (weekNumberParam) setSelectedWeekNumber(parseInt(weekNumberParam, 10));
    if (dayOfWeekParam) setSelectedDayOfWeek(dayOfWeekParam);
    if (hasImageParam) setHasImage(hasImageParam);
  }, [location.search]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleThemeChange = (theme: string) => setSelectedTheme(theme);
  const handleAgeGroupChange = (ageGroup: AgeGroup) => setSelectedAgeGroup(ageGroup);
  const handleWeekNumberChange = (weekNumber: number | null) => setSelectedWeekNumber(weekNumber);
  const handleDayOfWeekChange = (dayOfWeek: string) => setSelectedDayOfWeek(dayOfWeek);
  const handleHasImageChange = (value: string) => setHasImage(value);
  const handleSeriesChange = (value: string) => setSelectedSeries(value);
  const handleSearch = () => setDebouncedSearchTerm(searchTerm);
  const handleCreateStory = () => navigate('/create');

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

  const loading = isStoriesLoading || isFetching; // Or mostly just initial load? 'isFetching' is true on background refetch too.
  // We probably want 'isStoriesLoading' (initial) or 'isFetchingNextPage' for load more.
  // But StoriesListGrid uses 'loading' to show spinner.
  
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
            weeklyThemeId={weeklyThemeDetails.id}
            weeklyThemeName={weeklyThemeDetails.name}
            weeklyThemesMap={weeklyThemesMap}
            selectedAgeGroup={selectedAgeGroup}
            handleAgeGroupChange={handleAgeGroupChange}
            selectedWeekNumber={selectedWeekNumber}
            handleWeekNumberChange={handleWeekNumberChange}
            selectedDayOfWeek={selectedDayOfWeek}
            handleDayOfWeekChange={handleDayOfWeekChange}
            hasImage={hasImage}
            handleHasImageChange={handleHasImageChange}
            series={seriesList}
            selectedSeries={selectedSeries}
            handleSeriesChange={handleSeriesChange}
          />
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
                themeColors={themeColors}
                observerRef={observerTarget}
                hasMore={!!hasNextPage}
                handleCreateStory={handleCreateStory}
              />
              {isFetchingNextPage && <div className="text-center py-4">{t('common.loading')}...</div>}
            </TabsContent>
            <TabsContent value="export">
              <PDFExport availableStories={stories} />
            </TabsContent>
          </Tabs>
        </div>
    </PageLayout>
  );
};

export default StoriesPage;
