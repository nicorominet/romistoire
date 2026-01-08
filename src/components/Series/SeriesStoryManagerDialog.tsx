import React, { useState, useMemo } from "react";
import { i18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Series } from "@/types/Series";
import { useStories, useInfiniteStories } from "@/hooks/useStories";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { storyApi, seriesApi } from "@/api/stories.api";
import { getAgeGroupColor, cn } from "@/lib/utils";
import { useThemes, useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { AgeGroup } from "@/types/Story";
import StoriesSearch from "@/components/Story/StoriesList/StoriesSearch";

// Sentinel component for infinite scroll
/**
 * Sentinel component to trigger infinite scroll load.
 * Place this at the bottom of a scrollable list.
 * @param {Object} props
 * @param {() => void} props.onIntersect - Callback when sentinel is visible.
 * @param {boolean} props.hasMore - Whether there are more items to load.
 * @param {boolean} props.isLoading - Whether items are currently loading.
 */
const Sentinel = ({ onIntersect, hasMore, isLoading }: { onIntersect: () => void, hasMore: boolean, isLoading: boolean }) => {
    const observerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoading) {
                    onIntersect();
                }
            },
            { rootMargin: '100px' }
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => observer.disconnect();
    }, [onIntersect, hasMore, isLoading]);

    return <div ref={observerRef} className="h-4 w-full flex justify-center p-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
    </div>;
};

interface SeriesStoryManagerDialogProps {
  series: Series | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog to manage stories within a series (add/remove stories).
 * Supports infinite scrolling and filtering for both available and in-series stories.
 * 
 * @param {SeriesStoryManagerDialogProps} props
 */
export const SeriesStoryManagerDialog: React.FC<SeriesStoryManagerDialogProps> = ({
  series,
  open,
  onOpenChange,
}) => {
  const t = (key: string, params?: any) => i18n.t(key, params);
  const queryClient = useQueryClient();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup | 'all'>('all');
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [hasImage, setHasImage] = useState<string>('all');
  const [hasAudio, setHasAudio] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedEditStatus, setSelectedEditStatus] = useState<string>('all');
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('all');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('all');
  
  // Metadata from Hooks
  const { data: themesData = [] } = useThemes();
  const { data: seriesData = [] } = useSeries();
  const { data: weeklyData = [] } = useWeeklyThemes();

  const availableThemes = themesData as {id: string, name: string}[];
  const availableSeries = seriesData as {id: string, name: string}[];

  const weeklyThemesMap = React.useMemo(() => {
    const map: {[key: number]: string} = {};
    weeklyData.forEach((wt: any) => {
      map[wt.week_number] = wt.theme_name;
    });
    return map;
  }, [weeklyData]);

  const handleSearch = () => setDebouncedSearchTerm(searchTerm);
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedAgeGroup('all');
    setSelectedTheme('all');
    setSelectedWeekNumber(null);
    setHasImage('all');
    setHasAudio('all');
    setSelectedSource('all');
    setSelectedEditStatus('all');
    setSelectedSeriesFilter('all');
    setSelectedDayOfWeek('all');
  };

  const handleAgeGroupChange = (ageGroup: AgeGroup | 'all') => setSelectedAgeGroup(ageGroup);
  const handleThemeChange = (theme: string) => setSelectedTheme(theme);
  const handleWeekNumberChange = (week: number | null) => setSelectedWeekNumber(week);
  const handleHasImageChange = (value: string) => setHasImage(value);
  const handleHasAudioChange = (value: string) => setHasAudio(value);
  const handleSourceChange = (value: string) => setSelectedSource(value);
  const handleEditStatusChange = (value: string) => setSelectedEditStatus(value);
  const handleSeriesChange = (seriesId: string) => setSelectedSeriesFilter(seriesId);
  const handleDayOfWeekChange = (day: string) => setSelectedDayOfWeek(day);

  // No manual metadata fetch needed (handled by hooks)

  // Handle Search Debounce
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Infinite Query for Available Stories
  const { 
    data: availableData, 
    fetchNextPage: fetchNextAvailable, 
    hasNextPage: hasNextAvailable, 
    isFetchingNextPage: isFetchingNextAvailable,
    isLoading: isLoadingLeft 
  } = useInfiniteStories({
     seriesId: 'all', // Not filtering by another series on the left
     excludeSeriesId: series?.id,
     search: debouncedSearchTerm,
     ageGroup: selectedAgeGroup !== 'all' ? selectedAgeGroup : undefined,
     weekNumber: selectedWeekNumber ? selectedWeekNumber.toString() : undefined,
     theme: selectedTheme !== 'all' ? selectedTheme : undefined,
     hasImage: hasImage !== 'all' ? hasImage : undefined,
     hasAudio: hasAudio !== 'all' ? hasAudio : undefined,
     source: selectedSource !== 'all' ? selectedSource : undefined,
     editStatus: selectedEditStatus !== 'all' ? selectedEditStatus : undefined,
     dayOfWeek: selectedDayOfWeek !== 'all' ? selectedDayOfWeek : undefined,
     limit: 20 
  });

  // Infinite Query for In Series Stories
  const { 
    data: inSeriesData, 
    fetchNextPage: fetchNextInSeries, 
    hasNextPage: hasNextInSeries, 
    isFetchingNextPage: isFetchingNextInSeries,
    isLoading: isLoadingRight 
  } = useInfiniteStories({
     seriesId: series?.id,
     search: debouncedSearchTerm,
     ageGroup: selectedAgeGroup !== 'all' ? selectedAgeGroup : undefined,
     weekNumber: selectedWeekNumber ? selectedWeekNumber.toString() : undefined,
     theme: selectedTheme !== 'all' ? selectedTheme : undefined,
     hasImage: hasImage !== 'all' ? hasImage : undefined,
     hasAudio: hasAudio !== 'all' ? hasAudio : undefined,
     source: selectedSource !== 'all' ? selectedSource : undefined,
     editStatus: selectedEditStatus !== 'all' ? selectedEditStatus : undefined,
     dayOfWeek: selectedDayOfWeek !== 'all' ? selectedDayOfWeek : undefined,
     limit: 20
  });

  const availableStories = useMemo(() => 
    availableData?.pages.flatMap((page: any) => page.data || []) || [], 
  [availableData]);

  const inSeriesStories = useMemo(() => 
    inSeriesData?.pages.flatMap((page: any) => page.data || []) || [], 
  [inSeriesData]);

  /**
   * Batch update stories (add or remove from series).
   * @param {'add' | 'remove'} action - The action to perform.
   */
  const handleBatchUpdate = async (action: 'add' | 'remove') => {
    if (!series) return;
    const storyIds = action === 'add' ? selectedLeft : selectedRight;
    if (storyIds.length === 0) return;

    setIsProcessing(true);
    try {
      if (action === 'add') {
          await seriesApi.addBatchStories(series.id, storyIds);
      } else {
          await seriesApi.removeBatchStories(series.id, storyIds);
      }

      // Refetch both lists
      await queryClient.invalidateQueries({ queryKey: ['stories'] });
      await queryClient.invalidateQueries({ queryKey: ['series-stats', series.id] });
      await queryClient.invalidateQueries({ queryKey: ['series'] });

      toast.success(t(`series.management.manager.success${action === 'add' ? 'Add' : 'Remove'}`, { count: storyIds.length }));
      
      // Clear selection
      if (action === 'add') setSelectedLeft([]);
      else setSelectedRight([]);

    } catch (e) {
      toast.error(t("common.operationFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Toggle selection of a story in a list.
   * @param {string} id - The ID of the story.
   * @param {'left' | 'right'} list - Which list the story belongs to (left=available, right=in-series).
   */
  const toggleSelection = (id: string, list: 'left' | 'right') => {
    const setSelected = list === 'left' ? setSelectedLeft : setSelectedRight;
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (!series) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-white/10">
        <DialogHeader className="p-6 pb-2">
             <DialogTitle className="text-2xl font-bold text-story-purple-800 dark:text-story-purple-400">
               {t("series.management.manager.title")} - <span className="text-gray-900 dark:text-gray-100">{series.name}</span>
             </DialogTitle>
             <p className="text-sm text-gray-500">{t("series.management.manager.description")}</p>
        </DialogHeader>

        <div className="px-6 flex flex-col gap-2 flex-grow min-h-0 overflow-hidden pb-6">
          <StoriesSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            selectedTheme={selectedTheme}
            handleThemeChange={handleThemeChange}
            themes={availableThemes}
            weeklyThemeId={null}
            weeklyThemeName={null}
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
            series={availableSeries as any}
            selectedSeries={selectedSeriesFilter}
            handleSeriesChange={handleSeriesChange}
            selectedSource={selectedSource}
            handleSourceChange={handleSourceChange}
            selectedEditStatus={selectedEditStatus}
            handleEditStatusChange={handleEditStatusChange}
            handleResetFilters={handleResetFilters}
            disableSeriesFilter={true}
          />

          {isLoadingLeft || isLoadingRight ? (
               <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-story-purple-600" />
                    <p className="text-sm text-gray-500 animate-pulse">{t("common.loading")}</p>
                  </div>
               </div>
          ) : (
          <div className="flex-1 flex gap-4 min-h-0 pt-2">
            {/* Left Panel: Available */}
            <div className="flex-[5] flex flex-col border rounded-xl overflow-hidden bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border-white/20 dark:border-white/10 shadow-sm">
              <div className="p-4 border-b bg-white/60 dark:bg-slate-800/60 backdrop-blur-md flex justify-between items-center">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-200">
                    {t("series.management.manager.availableStories")} 
                    <span className="ml-2 text-xs bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-normal">
                      {availableStories.length}
                    </span>
                  </h4>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {availableStories.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white/30 dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
                        <Search className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-400">{t("series.management.manager.noStoriesAvailable")}</p>
                      </div>
                  ) : availableStories.map((story: any) => (
                      <div 
                          key={story.id} 
                          onClick={() => toggleSelection(story.id, 'left')}
                          className={cn(
                              "p-3 rounded-lg cursor-pointer text-sm flex items-center gap-3 border transition-all duration-200",
                              selectedLeft.includes(story.id) 
                                  ? "bg-story-purple-50 border-story-purple-200 text-story-purple-700 dark:bg-story-purple-900/20 dark:border-story-purple-800 dark:text-story-purple-300 shadow-sm"
                                  : "bg-white/80 dark:bg-slate-800/80 border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm"
                          )}
                      >
                          <div className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-all", 
                              selectedLeft.includes(story.id) ? "bg-story-purple-600 border-story-purple-600 rotate-0" : "border-gray-300 dark:border-slate-600"
                          )}>
                              {selectedLeft.includes(story.id) && <span className="text-white text-[12px]">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{story.title}</p>
                            <div className="flex gap-2 mt-1">
                               {story.age_group && (
                                  <span className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded font-bold border uppercase tracking-tighter",
                                      getAgeGroupColor(story.age_group)
                                  )}>
                                      {story.age_group}
                                  </span>
                               )}
                               {story.week_number && (
                                  <span className="text-[9px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                                      W{story.week_number}
                                  </span>
                              )}
                            </div>
                          </div>
                      </div>
                  ))}
                
                {/* Sentinel for infinite scroll */}
                <Sentinel 
                    onIntersect={fetchNextAvailable} 
                    hasMore={!!hasNextAvailable} 
                    isLoading={isFetchingNextAvailable} 
                />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col justify-center gap-6 px-2">
            <Button 
                variant="default" 
                disabled={selectedLeft.length === 0 || isProcessing}
                onClick={() => handleBatchUpdate('add')}
                className="bg-story-purple hover:bg-story-purple-600 shadow-md transform active:scale-95 transition-all w-12 h-12 rounded-full flex items-center justify-center p-0"
                title={t("series.management.manager.addSelected")}
            >
                <ChevronRight className="h-6 w-6" />
            </Button>
            <Button 
                variant="secondary"
                disabled={selectedRight.length === 0 || isProcessing}
                onClick={() => handleBatchUpdate('remove')}
                className="shadow-sm border-gray-200 dark:border-slate-700 transform active:scale-95 transition-all w-12 h-12 rounded-full flex items-center justify-center p-0"
                title={t("series.management.manager.removeSelected")}
            >
                <ChevronLeft className="h-6 w-6" />
            </Button>
          </div>

          {/* Right Panel: In Series */}
          <div className="flex-[4] flex flex-col border rounded-xl overflow-hidden bg-indigo-50/20 dark:bg-slate-900/40 backdrop-blur-sm border-indigo-100 dark:border-slate-700 shadow-sm">
             <div className="p-4 border-b bg-white/60 dark:bg-slate-800/60 backdrop-blur-md flex justify-between items-center">
                <h4 className="font-semibold text-indigo-700 dark:text-indigo-300">
                  {t("series.management.manager.inSeries")} 
                  <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full font-normal">
                    {inSeriesStories.length}
                  </span>
                </h4>
            </div>
           <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {inSeriesStories.length === 0 && !isLoadingRight ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white/30 dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-gray-100 dark:border-slate-700">
                      <p className="text-sm text-gray-400">{t("series.management.manager.noStoriesInSeries")}</p>
                    </div>
                ) : inSeriesStories.map((story: any) => (
                    <div 
                        key={story.id} 
                        onClick={() => toggleSelection(story.id, 'right')}
                        className={cn(
                            "p-3 rounded-lg cursor-pointer text-sm flex items-center gap-3 border transition-all duration-200",
                            selectedRight.includes(story.id) 
                                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300 shadow-sm" 
                                : "bg-white/80 dark:bg-slate-800/80 border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm"
                        )}
                    >
                       <div className={cn(
                           "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                           selectedRight.includes(story.id) ? "bg-red-500 border-red-500 rotate-0" : "border-gray-300 dark:border-slate-600"
                       )}>
                            {selectedRight.includes(story.id) && <span className="text-white text-[12px]">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{story.title}</p>
                          <div className="flex gap-2 mt-1">
                             {story.age_group && (
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded font-bold border uppercase tracking-tighter",
                                    getAgeGroupColor(story.age_group)
                                )}>
                                    {story.age_group}
                                </span>
                             )}
                            {story.week_number && (
                                <span className="text-[9px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                                    W{story.week_number}
                                </span>
                            )}
                          </div>
                        </div>
                    </div>
                ))}

                {/* Sentinel for infinite scroll */}
                <Sentinel 
                    onIntersect={fetchNextInSeries} 
                    hasMore={!!hasNextInSeries} 
                    isLoading={isFetchingNextInSeries} 
                />
            </div>
          </div>
        </div>
        ) as any}
      </div>
    </DialogContent>
    </Dialog>
  );
};
