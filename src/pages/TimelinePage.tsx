import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/Layout/PageLayout";
import { i18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import "@/App.css";
import { getAgeGroupColor } from "@/lib/utils";
import useDarkMode from '@/hooks/useDarkMode';
import SafeImage from "@/components/ui/SafeImage";
import { storyApi } from "@/api/stories.api";
import { useStoryMutations } from "@/hooks/useStory";
import { useThemes, useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import StoriesSearch from "@/components/Story/StoriesList/StoriesSearch";
import { Trash2, AlertTriangle, Sparkles, Cpu, User, PenLine } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { Story, AGE_GROUPS } from "@/types/Story";

interface ThemeColors {
  [themeId: string]: string;
}

interface WeeklyThemes {
  [weekNumber: number]: string;
}

import { APP_ROUTES } from "@/constants";
import { Theme, WeeklyTheme } from "@/types/Theme";
import { Series } from '@/types/Series';

const TimelinePage: React.FC = () => {
  // Master list of weeks that match current filters
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  // Weeks that are currently loaded/displayed
  const [loadedWeeks, setLoadedWeeks] = useState<number[]>([]);
  // Stories grouped by week
  const [storiesByWeek, setStoriesByWeek] = useState<{ [week: number]: Story[] }>({});
  
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  
  // Filters
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [hasImage, setHasImage] = useState<string>('all');
  const [hasAudio, setHasAudio] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedEditStatus, setSelectedEditStatus] = useState<string>('all');
  // Metadata from Hooks
  const { data: themesDataRaw = [] } = useThemes();
  const { data: seriesDataRaw = [] } = useSeries();
  const { data: weeklyDataRaw = [] } = useWeeklyThemes();
  
  const themesData = themesDataRaw as Theme[];
  const seriesData = seriesDataRaw as Series[];
  const weeklyData = weeklyDataRaw as WeeklyTheme[];

  const themeColors = React.useMemo(() => {
    const colors: ThemeColors = {};
    themesData.forEach((t) => {
      if (t.color) colors[t.id] = t.color;
    });
    return colors;
  }, [themesData]);

  const weeklyThemes = React.useMemo(() => {
    const weeklyMap: WeeklyThemes = {};
    weeklyData.forEach((item) => {
      weeklyMap[item.week_number] = item.theme_name;
    });
    return weeklyMap;
  }, [weeklyData]);

  const availableThemes = themesData;
  const availableSeries = seriesData;
  
  // ... (rest of imports and hooks)
  const observerTarget = useRef<HTMLDivElement>(null);
  const darkMode = useDarkMode();
  const { t } = i18n;
  const { deleteStory } = useStoryMutations();
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // ... (hasActiveFilters logic)
  const hasActiveFilters = 
    selectedAgeGroup !== null || 
    selectedTheme !== null || 
    selectedWeek !== null || 
    selectedSeries !== 'all' ||
    searchTerm !== '' ||
    hasImage !== 'all' ||
    hasAudio !== 'all' ||
    selectedSource !== 'all' ||
    selectedEditStatus !== 'all';

  const handleSearch = () => setDebouncedSearchTerm(searchTerm);
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedAgeGroup(null);
    setSelectedTheme(null);
    setSelectedWeek(null);
    setSelectedSeries('all');
    setHasImage('all');
    setHasAudio('all');
    setSelectedSource('all');
    setSelectedEditStatus('all');
  };

  const handleAgeGroupChange = (ageGroup: string) => {
    setSelectedAgeGroup(ageGroup === 'all' ? null : ageGroup);
  };

  const handleThemeChange = (theme: string | null) => {
    setSelectedTheme(theme === 'all' ? null : theme);
  };

  const handleWeekChange = (week: number | null) => {
    setSelectedWeek(week);
  };

  const handleSeriesChange = (seriesId: string) => {
    setSelectedSeries(seriesId);
  };
  
  const handleHasImageChange = (value: string) => setHasImage(value);
  const handleHasAudioChange = (value: string) => setHasAudio(value);
  const handleSourceChange = (value: string) => setSelectedSource(value);
  const handleEditStatusChange = (value: string) => setSelectedEditStatus(value);

  const handleDeleteStory = async () => {
      if (storyToDelete) {
          try {
              await deleteStory.mutateAsync(storyToDelete);
              removeStoryFromState(storyToDelete);
          } catch (e) {
              console.error("Failed to delete story", e);
          } finally {
              setStoryToDelete(null);
          }
      }
  };

  const removeStoryFromState = (id: string) => {
      setStoriesByWeek(prev => {
          const nextState = { ...prev };
          for (const week in nextState) {
              nextState[week] = nextState[week].filter(s => s.id !== id);
          }
          return nextState;
      });
  };

  // 2. Fetch Available Weeks when filters change
  useEffect(() => {
    const fetchWeeks = async () => {
      setLoading(true);
      setStoriesByWeek({});
      setLoadedWeeks([]);
      try {
        const queryParams: Record<string, string> = {};
        if (selectedAgeGroup && selectedAgeGroup !== 'all') queryParams.ageGroup = selectedAgeGroup;
        if (selectedTheme && selectedTheme !== 'all') queryParams.theme = selectedTheme;
        if (selectedSeries && selectedSeries !== 'all') queryParams.seriesId = selectedSeries;
        if (selectedWeek) queryParams.weekNumber = selectedWeek.toString();
        
        // Add new filters
        if (debouncedSearchTerm) queryParams.searchTerm = debouncedSearchTerm;
        if (hasImage !== 'all') queryParams.hasImage = hasImage;
        if (hasAudio !== 'all') queryParams.hasAudio = hasAudio;
        if (selectedSource !== 'all') queryParams.source = selectedSource;
        if (selectedEditStatus !== 'all') queryParams.editStatus = selectedEditStatus;

        const weeks = (await storyApi.getAvailableWeeks(queryParams));
        setAvailableWeeks(weeks);
          
        // Load first week immediately if exists
        if (weeks.length > 0) {
            await loadWeek(weeks[0], queryParams);
            setLoadedWeeks([weeks[0]]);
        }
      } catch (err) {
        console.error("Failed to fetch weeks", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWeeks();
  }, [selectedAgeGroup, selectedTheme, selectedWeek, selectedSeries, debouncedSearchTerm, hasImage, hasAudio, selectedSource, selectedEditStatus]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Helper to load a specific week
  const loadWeek = async (weekNumber: number, baseParams: Record<string, string>) => {
      try {
          const params = { 
              ...baseParams, 
              weekNumber: weekNumber.toString(), 
              limit: 100, 
              page: 1,
          };
          
          const data = await storyApi.getAll(params);
          setStoriesByWeek(prev => ({
              ...prev,
              [weekNumber]: data.data
          }));
      } catch (e) {
          console.error(`Failed to load week ${weekNumber}`, e);
      }
  };

  // 3. Infinite Scroll: Load next week
  const handleLoadMore = useCallback(async () => {
      if (loading || loadingMore || loadedWeeks.length >= availableWeeks.length) return;
      
      const nextWeekIndex = loadedWeeks.length;
      const nextWeek = availableWeeks[nextWeekIndex];
      
      setLoadingMore(true);
      
      const queryParams: Record<string, string> = {};
      if (selectedAgeGroup && selectedAgeGroup !== 'all') queryParams.ageGroup = selectedAgeGroup;
      if (selectedTheme && selectedTheme !== 'all') queryParams.theme = selectedTheme;
      if (selectedSeries && selectedSeries !== 'all') queryParams.seriesId = selectedSeries;
      
      if (debouncedSearchTerm) queryParams.searchTerm = debouncedSearchTerm;
      if (hasImage !== 'all') queryParams.hasImage = hasImage;
      if (hasAudio !== 'all') queryParams.hasAudio = hasAudio;
      if (selectedSource !== 'all') queryParams.source = selectedSource;
      if (selectedEditStatus !== 'all') queryParams.editStatus = selectedEditStatus;

      await loadWeek(nextWeek, queryParams);
      
      setLoadedWeeks(prev => [...prev, nextWeek]);
      setLoadingMore(false);
  }, [loading, loadingMore, loadedWeeks, availableWeeks, selectedAgeGroup, selectedTheme, selectedSeries, debouncedSearchTerm, hasImage, hasAudio, selectedSource, selectedEditStatus]);

  // Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
            handleLoadMore();
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
  }, [handleLoadMore]);

  const groupStoriesByAge = (weekStories: Story[]) => {
    const grouped: { [age: string]: Story[] } = {};
    if(!weekStories) return grouped;
    
    weekStories.forEach((story) => {
      const age = story.age_group || "unknown";
      if (!grouped[age]) grouped[age] = [];
      grouped[age].push(story);
    });
    return grouped;
  };

  const getDayOfWeek = (dayOrder: number) => {
    const days = [
      i18n.t("days.monday"),
      i18n.t("days.tuesday"),
      i18n.t("days.wednesday"),
      i18n.t("days.thursday"),
      i18n.t("days.friday"),
      i18n.t("days.saturday"),
      i18n.t("days.sunday"),
    ];
    return days[dayOrder - 1];
  };

  const StoryCard = ({ storyForDay }: { storyForDay: Story }) => (
      <div className="relative group w-full h-full"> 
          <Link to={APP_ROUTES.STORY_DETAIL(storyForDay.id)} className="story-card-link w-full h-full block">
            <Card className="story-card hover-scale h-full flex flex-col transition-all duration-300 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/80 hover:shadow-lg shadow-sm">
              <CardHeader className="p-2 space-y-1">
                <div className="flex justify-between items-start gap-1">
                  <div className="flex items-center text-story-purple-600 dark:text-story-purple-400">
                    {storyForDay.source === 'gemini' && <Sparkles className="h-2.5 w-2.5" />}
                    {storyForDay.source === 'ollama' && <Cpu className="h-2.5 w-2.5" />}
                    {storyForDay.source === 'manual' && <User className="h-2.5 w-2.5" />}
                    {!!storyForDay.is_manually_edited && storyForDay.source !== 'manual' && (
                       <PenLine className="ml-0.5 h-2 w-2 opacity-70" />
                    )}
                  </div>
                  {storyForDay.series_name && (
                    <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide truncate text-right pr-6">
                      {storyForDay.series_name}
                    </div>
                  )}
                </div>
                <CardTitle className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight pr-5"> 
                  {storyForDay.title}
                </CardTitle>
                <div className="flex flex-wrap gap-1">
                       {Array.isArray(storyForDay.themes) && storyForDay.themes.length > 0 && storyForDay.themes.slice(0, 1).map((themeObj: { id: string, name?: string }) => (
                         <Badge
                            key={themeObj.id}
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4"
                             style={{ backgroundColor: themeColors[themeObj.id] || "#ccc", color: "#fff" }}
                         >
                           {themeObj.name || themeObj.id}
                         </Badge>
                       ))}
                    </div>
              </CardHeader>
              {storyForDay.illustrations?.[0]?.image_path && (
                  <SafeImage
                    src={`/${storyForDay.illustrations[0].image_path}`}
                    alt={storyForDay.title}
                    className="w-full h-20 sm:h-24 object-cover rounded-md mb-1 px-2"
                  />
                )}
              <CardContent className="p-2 pt-0 flex-grow">
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                   {storyForDay.content}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 hover:bg-red-100 hover:text-red-600 rounded-full"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStoryToDelete(storyForDay.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
      </div>
  );

  return (
    <PageLayout>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h1 className="text-3xl font-bold text-story-purple-800">{t('timeline.manageWeeklyThemes')}</h1>
             </div>
          </div>

          <StoriesSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            selectedTheme={selectedTheme || 'all'}
            handleThemeChange={handleThemeChange}
            themes={availableThemes}
            weeklyThemeId={null} // Handled by weeklyThemesMap in this view
            weeklyThemeName={null}
            weeklyThemesMap={weeklyThemes}
            selectedAgeGroup={(selectedAgeGroup as any) || 'all'}
            handleAgeGroupChange={handleAgeGroupChange}
            selectedWeekNumber={selectedWeek}
            handleWeekNumberChange={handleWeekChange}
            selectedDayOfWeek={'all'} // Not used in timeline group view for filtering purposes here
            handleDayOfWeekChange={() => {}}
            hasImage={hasImage}
            handleHasImageChange={handleHasImageChange}
            hasAudio={hasAudio}
            handleHasAudioChange={handleHasAudioChange}
            series={availableSeries}
            selectedSeries={selectedSeries}
            handleSeriesChange={handleSeriesChange}
            selectedSource={selectedSource}
            handleSourceChange={handleSourceChange}
            selectedEditStatus={selectedEditStatus}
            handleEditStatusChange={handleEditStatusChange}
            handleResetFilters={handleResetFilters}
          />

          <Card className={`min-h-screen flex flex-col bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg ${darkMode ? 'dark' : ''}`}>
            <CardContent>
              <div className="timeline-container">
                {loadedWeeks.map(weekNumber => {
                    const stories = storiesByWeek[weekNumber] || [];
                    const ageGroups = groupStoriesByAge(stories);
                    if (Object.keys(ageGroups).length === 0) return null;

                    return (
                        <div key={weekNumber} className="week mb-12 border-b pb-8 last:border-0">
                            <div className="week-header mb-6">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    {i18n.t("timeline.weekNumber", { number: weekNumber.toString() })}
                                    {weeklyThemes[weekNumber] && (
                                        <span className="text-lg font-normal text-gray-500">
                                            - {weeklyThemes[weekNumber]}
                                        </span>
                                    )}
                                </h2>
                            </div>
                            
                            {/* Sort age groups to keep consistent order */}
                            {Object.entries(ageGroups)
                                .sort(([a], [b]) => AGE_GROUPS.indexOf(a as any) - AGE_GROUPS.indexOf(b as any))
                                .map(([ageGroup, storiesForAge]) => (
                                    <div key={`${weekNumber}-${ageGroup}`} className="age-group mb-6">
                                        <h3 className="text-xl font-semibold mb-4 pl-4 border-l-4 border-story-purple-300">
                                            {i18n.t(`ages.${ageGroup}`)}
                                        </h3>
                                        <div className="grid grid-cols-7 gap-2 pb-4">
                                            {[1, 2, 3, 4, 5, 6, 7].map(dayOrder => {
                                                const dayStories = storiesForAge.filter(s => s.day_order === dayOrder);
                                                return (
                                                    <div key={dayOrder} className="flex flex-col min-w-0">
                                                        <span className="text-xs text-center text-gray-400 mb-1 truncate">{getDayOfWeek(dayOrder)}</span>
                                                        {dayStories.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {dayStories.map(story => (
                                                                    <StoryCard key={story.id} storyForDay={story} />
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300 min-h-[100px]">
                                                                <span className="text-xs">-</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    );
                })}
                
                {/* Sentinel / Loading State */}
                <div ref={observerTarget} className="h-20 flex justify-center items-center">
                    {(loading || loadingMore) && <div className="spinner w-8 h-8 border-4 border-story-purple-600 border-t-transparent rounded-full animate-spin"></div>}
                    {!loading && !loadingMore && loadedWeeks.length === availableWeeks.length && availableWeeks.length > 0 && (
                        <p className="text-gray-400 italic">{t('timeline.noMoreStories')}</p>
                    )}
                     {!loading && availableWeeks.length === 0 && (
                        <p className="text-gray-500">{t('stories.noResults')}</p>
                    )}
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        
        <AlertDialog open={!!storyToDelete} onOpenChange={(open) => !open && setStoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  {t('common.confirmDelete')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('common.deleteWarning', { item: t('timeline.thisStory') })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStory} className="bg-red-500 hover:bg-red-600">
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
    </PageLayout>
  );
};

export default TimelinePage;