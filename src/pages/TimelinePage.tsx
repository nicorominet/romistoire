import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/Layout/PageLayout";
import { i18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import "@/App.css";
import { getAgeGroupColor } from "@/lib/utils";
import useDarkMode from '@/hooks/useDarkMode';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SafeImage from "@/components/ui/SafeImage";
import { themeApi, weeklyThemeApi } from "@/api/themes.api";
import { storyApi, seriesApi } from "@/api/stories.api";

interface ThemeColors {
  [themeId: string]: string;
}

interface WeeklyThemes {
  [weekNumber: number]: string;
}

interface Theme {
  id: string;
  name: string;
}

import { AGE_GROUPS } from "@/types/Story";

const TimelinePage: React.FC = () => {
  // Master list of weeks that match current filters
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  // Weeks that are currently loaded/displayed
  const [loadedWeeks, setLoadedWeeks] = useState<number[]>([]);
  // Stories grouped by week
  const [storiesByWeek, setStoriesByWeek] = useState<{ [week: number]: any[] }>({});
  
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  
  // Filters
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  // Metadata
  const [themeColors, setThemeColors] = useState<ThemeColors>({});
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [availableSeries, setAvailableSeries] = useState<{id: string, name: string}[]>([]);
  const [weeklyThemes, setWeeklyThemes] = useState<WeeklyThemes>({});
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const darkMode = useDarkMode();
  const { t } = i18n;

  // 1. Fetch Metadata (Themes, Colors, Series) - Once
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const themesData = (await themeApi.getAll()) as any;
        setAvailableThemes(themesData);
        const colors: ThemeColors = {};
        themesData.forEach((t: any) => {
          if (t.color) colors[t.id] = t.color;
        });
        setThemeColors(colors);

        const weeklyData = (await weeklyThemeApi.getAll()) as any;
        const weeklyMap: WeeklyThemes = {};
        weeklyData.forEach((item: any) => {
          weeklyMap[item.week_number] = item.theme_name;
        });
        setWeeklyThemes(weeklyMap);

        const seriesData = (await seriesApi.getAll()) as any;
        setAvailableSeries(seriesData);
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    };
    fetchMetadata();
  }, []);

  // 2. Fetch Available Weeks when filters change
  useEffect(() => {
    const fetchWeeks = async () => {
      setLoading(true);
      setStoriesByWeek({});
      setLoadedWeeks([]);
      try {
        const queryParams = new URLSearchParams({ locale: i18n.getCurrentLocale() });
        if (selectedAgeGroup && selectedAgeGroup !== 'all') queryParams.append('ageGroup', selectedAgeGroup);
        if (selectedTheme && selectedTheme !== 'all') queryParams.append('theme', selectedTheme);
        if (selectedSeries && selectedSeries !== 'all') queryParams.append('seriesId', selectedSeries);
        if (selectedWeek) queryParams.append('weekNumber', selectedWeek.toString());

        const weeks = (await storyApi.getAvailableWeeks(Object.fromEntries(queryParams))) as any as number[];
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
  }, [selectedAgeGroup, selectedTheme, selectedWeek, selectedSeries]);

  // Helper to load a specific week
  const loadWeek = async (weekNumber: number, baseParams: URLSearchParams) => {
      try {
          const params = new URLSearchParams(baseParams);
          params.set('weekNumber', weekNumber.toString());
          // Fetch ALL stories for this week
          params.append('limit', '100'); 
          
          const data = (await storyApi.getAll(Object.fromEntries(params) as any)) as any;
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
      
      const queryParams = new URLSearchParams({ locale: i18n.getCurrentLocale() });
      if (selectedAgeGroup && selectedAgeGroup !== 'all') queryParams.append('ageGroup', selectedAgeGroup);
      if (selectedTheme && selectedTheme !== 'all') queryParams.append('theme', selectedTheme);
      if (selectedSeries && selectedSeries !== 'all') queryParams.append('seriesId', selectedSeries);
      // Note: If selectedWeek is set, availableWeeks length is 1, so this won't trigger anyway.

      await loadWeek(nextWeek, queryParams);
      
      setLoadedWeeks(prev => [...prev, nextWeek]);
      setLoadingMore(false);
  }, [loadingMore, loadedWeeks, availableWeeks, selectedAgeGroup, selectedTheme, selectedSeries]);

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


  const groupStoriesByAge = (weekStories: any[]) => {
    const grouped: { [age: string]: any[] } = {};
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

  const handleAgeGroupChange = (ageGroup: string | null) => {
    setSelectedAgeGroup(ageGroup);
  };

  const handleThemeChange = (theme: string | null) => {
    setSelectedTheme(theme);
  };

  const handleWeekChange = (week: number | null) => {
    setSelectedWeek(week);
  };

  const FilterSelect = ({ labelKey, placeholderKey, value, onValueChange, options }: {
    labelKey: string;
    placeholderKey: string;
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string, label: string }[];
  }) => (
    <Select
      value={value}
      onValueChange={onValueChange}
      aria-label={t(labelKey)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t(placeholderKey)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t(placeholderKey)}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const StoryCard = ({ storyForDay }: { storyForDay: any }) => (
      <Link to={`/stories/${storyForDay.id}`} className="story-card-link w-full h-full block">
        <Card className="story-card hover-scale h-full flex flex-col transition-all duration-300 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/80 hover:shadow-lg shadow-sm">
          <CardHeader className="p-2 space-y-1">
            {storyForDay.series_name && (
              <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide truncate pr-2">
                {storyForDay.series_name}
              </div>
            )}
            <CardTitle className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
              {storyForDay.title}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
                   {/* Badges might be too big for 7-col layout, keep them tiny or hidden on small screens? Let's keep them tiny. */}
                   {Array.isArray(storyForDay.themes) && storyForDay.themes.length > 0 && storyForDay.themes.slice(0, 1).map((themeObj: any) => (
                     <Badge
                        key={themeObj.id}
                        variant="outline"
                        className="text-[10px] px-1 py-0 h-4"
                         style={{ backgroundColor: themeColors[themeObj.id] || "#ccc", color: "#fff" }}
                     >
                       {themeObj.name || themeObj.id}
                     </Badge>
                   ))}
                   {/* Age badge maybe redundant since we group by age? Removing for space or keeping minimal */}
                </div>
          </CardHeader>
          {storyForDay.illustrations?.[0]?.image_path && (
              <SafeImage
                src={`/${storyForDay.illustrations[0].image_path}`}
                alt={storyForDay.title}
                className="w-full h-20 sm:h-24 object-cover rounded-md mb-1 px-2"
              />
            )}
          {/* Content might be too much, consider hiding on very small views or just line-clamp-1 */}
          <CardContent className="p-2 pt-0 flex-grow">
            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
               {storyForDay.content}
            </p>
          </CardContent>
        </Card>
      </Link>
  );

  return (
    <PageLayout>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h1 className="text-3xl font-bold text-story-purple-800">{t('timeline.manageWeeklyThemes')}</h1>
             </div>
          </div>

          <Card className="w-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg">
            <CardContent className="pt-6">
               <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                  <FilterSelect
                    labelKey="timeline.selectAgeGroup"
                    placeholderKey="timeline.allAges"
                    value={selectedAgeGroup || 'all'}
                    onValueChange={(value) => handleAgeGroupChange(value === 'all' ? null : value)}
                    options={AGE_GROUPS.map((age) => ({ value: age, label: t(`ages.${age}`) }))}
                  />
                  <FilterSelect
                    labelKey="timeline.selectWeek"
                    placeholderKey="timeline.allWeeks"
                    value={selectedWeek?.toString() || 'all'}
                    onValueChange={(value) => handleWeekChange(value === 'all' ? null : parseInt(value, 10))}
                    options={Array.from({ length: 104 }, (_, i) => i + 1).map(week => ({
                        value: week.toString(),
                        label: `${t("timeline.weekNumber", { number: week.toString() })}${weeklyThemes[week] ? ` - ${weeklyThemes[week]}` : ''}`
                    }))}
                  />
                  <FilterSelect
                    labelKey="timeline.filterSelectTheme"
                    placeholderKey="timeline.filterAllThemes"
                    value={selectedTheme || 'all'}
                    onValueChange={(value) => handleThemeChange(value === 'all' ? null : value)}
                    options={availableThemes.map((theme) => ({ value: theme.id, label: theme.name }))}
                  />
                   {/* Series Filter */}
                   <Select
                      value={selectedSeries || 'all'}
                      onValueChange={(value) => setSelectedSeries(value === 'all' ? null : value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("story.series")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("story.allSeries")}</SelectItem>
                        {availableSeries.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
               </div>
            </CardContent>
          </Card>

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
                        <p className="text-gray-400 italic">{t('stories.noResults')}</p>
                    )}
                     {!loading && availableWeeks.length === 0 && (
                        <p className="text-gray-500">{t('stories.noResults')}</p>
                    )}
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
    </PageLayout>
  );
};

export default TimelinePage;