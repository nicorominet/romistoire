import React, { useState, useMemo } from "react";
import { i18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Series } from "@/types/Series";
import { useStories, useInfiniteStories } from "@/hooks/useStories";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import client from "@/api/client";
import { storyApi } from "@/api/stories.api";
import { getAgeGroupColor, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ageFilter, setAgeFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");

  const ageGroups = ["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"];

  // Fetch available weeks
  const { data: availableWeeks = [] } = useQuery({
    queryKey: ['stories', 'available-weeks', { locale: i18n.language }],
    queryFn: () => storyApi.getAvailableWeeks({ locale: i18n.language }),
    staleTime: 5 * 60 * 1000,
  });

  // Infinite Query for Available Stories
  const { 
    data: availableData, 
    fetchNextPage: fetchNextAvailable, 
    hasNextPage: hasNextAvailable, 
    isFetchingNextPage: isFetchingNextAvailable,
    isLoading: isLoadingLeft 
  } = useInfiniteStories({
     excludeSeriesId: series?.id,
     search: leftSearch,
     ageGroup: ageFilter !== 'all' ? ageFilter : undefined,
     weekNumber: weekFilter !== 'all' ? weekFilter : undefined,
     limit: 20 // Smaller limit per page for smoother loading
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
     search: rightSearch,
     ageGroup: ageFilter !== 'all' ? ageFilter : undefined,
     weekNumber: weekFilter !== 'all' ? weekFilter : undefined,
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
      await client.post(`/api/series/${series.id}/stories/batch`, {
        storyIds,
        action
      });

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
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
             <DialogTitle>{t("series.management.manager.title")} - {series.name}</DialogTitle>
             <p className="text-sm text-gray-500">{t("series.management.manager.description")}</p>
          </div>
          <div className="flex gap-2">
              <div className="w-[140px]">
                 <Select value={weekFilter} onValueChange={setWeekFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder={t("stories.allWeeks")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                        <SelectItem value="all">{t("stories.allWeeks")}</SelectItem>
                        {availableWeeks.map((week: any) => (
                            <SelectItem key={week} value={String(week)}>{t("series.management.kpi.week")} {week}</SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
              </div>
              <div className="w-[140px]">
                 <Select value={ageFilter} onValueChange={setAgeFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder={t("stories.allAges")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("stories.allAges")}</SelectItem>
                        {ageGroups.map(age => (
                            <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
              </div>
          </div>
        </DialogHeader>

        {isLoadingLeft || isLoadingRight ? (
             <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
             </div>
        ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel: Available */}
          <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-gray-50 dark:bg-slate-900">
            <div className="p-3 border-b bg-white dark:bg-slate-800">
                <h4 className="font-medium mb-2">{t("series.management.manager.availableStories")} ({availableStories.length})</h4>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder={t("series.management.manager.searchAvailable")} 
                        className="pl-9"
                        value={leftSearch}
                        onChange={e => setLeftSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {availableStories.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 p-4">{t("series.management.manager.noStoriesAvailable")}</p>
                ) : availableStories.map((story: any) => (
                    <div 
                        key={story.id} 
                        onClick={() => toggleSelection(story.id, 'left')}
                        className={cn(
                            "p-2 rounded cursor-pointer text-sm flex items-center gap-2 border transition-colors",
                            selectedLeft.includes(story.id) 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                                : "bg-white border-transparent hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors", 
                            selectedLeft.includes(story.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                        )}>
                            {selectedLeft.includes(story.id) && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <span className="truncate flex-1">{story.title}</span>
                         
                         {/* Age Group Badge */}
                         {story.age_group && (
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-bold border bg-opacity-10 dark:bg-opacity-20",
                                getAgeGroupColor(story.age_group)
                            )}>
                                {story.age_group}
                            </span>
                         )}

                         {story.week_number && (
                            <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                                W{story.week_number}
                            </span>
                        )}
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
          <div className="flex flex-col justify-center gap-4">
            <Button 
                variant="default" 
                disabled={selectedLeft.length === 0 || isProcessing}
                onClick={() => handleBatchUpdate('add')}
                className="bg-story-purple hover:bg-story-purple-600"
                title={t("series.management.manager.addSelected")}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
                variant="secondary"
                disabled={selectedRight.length === 0 || isProcessing}
                onClick={() => handleBatchUpdate('remove')}
                title={t("series.management.manager.removeSelected")}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Panel: In Series */}
          <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-indigo-50/30 dark:bg-slate-900/50 border-indigo-100 dark:border-slate-700">
             <div className="p-3 border-b bg-white dark:bg-slate-800">
                <h4 className="font-medium mb-2 text-indigo-700 dark:text-indigo-300">{t("series.management.manager.inSeries")} ({inSeriesStories.length})</h4>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder={t("series.management.manager.searchInSeries")} 
                        className="pl-9"
                        value={rightSearch}
                        onChange={e => setRightSearch(e.target.value)}
                    />
                </div>
            </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {inSeriesStories.length === 0 && !isLoadingRight ? (
                    <p className="text-center text-sm text-gray-400 p-4">{t("series.management.manager.noStoriesInSeries")}</p>
                ) : inSeriesStories.map((story: any) => (
                    <div 
                        key={story.id} 
                        onClick={() => toggleSelection(story.id, 'right')}
                        className={cn(
                            "p-2 rounded cursor-pointer text-sm flex items-center gap-2 border transition-colors",
                            selectedRight.includes(story.id) 
                                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800" 
                                : "bg-white border-transparent hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                        )}
                    >
                       <div className={cn(
                           "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                           selectedRight.includes(story.id) ? "bg-red-500 border-red-500" : "border-gray-300"
                       )}>
                            {selectedRight.includes(story.id) && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <span className="truncate flex-1">{story.title}</span>
                        
                        {/* Age Group Badge */}
                         {story.age_group && (
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-bold border bg-opacity-10 dark:bg-opacity-20",
                                getAgeGroupColor(story.age_group)
                            )}>
                                {story.age_group}
                            </span>
                         )}

                        {story.week_number && (
                            <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                                W{story.week_number}
                            </span>
                        )}
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
        )}
      </DialogContent>
    </Dialog>
  );
};
