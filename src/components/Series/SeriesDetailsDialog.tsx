import React, { useState } from "react";
import { i18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Settings2 } from "lucide-react";
import { Series } from "@/types/Series";
import { useSeriesStats } from "@/hooks/useSeries";
import { SeriesStoryManagerDialog } from "./SeriesStoryManagerDialog";
import { getAgeGroupColor, cn } from "@/lib/utils";

interface SeriesDetailsDialogProps {
  series: Series | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SeriesDetailsDialog: React.FC<SeriesDetailsDialogProps> = ({
  series,
  open,
  onOpenChange,
}) => {
  const t = (key: string, params?: any) => i18n.t(key, params);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Use the new stats hook
  const { data: stats, isLoading } = useSeriesStats(
    series && open ? series.id : null
  );

  if (!series) return null;

  // Process data from backend or fallback to empty
  const stories = stats?.stories || [];
  const totalStories = stories.length;
  
  // Calculate unique weeks from the list
  const uniqueWeeks = Array.from(new Set(stories.map((s: any) => s.week_number))).sort(
    (a: any, b: any) => a - b
  );

  const storiesByWeek: Record<number, any[]> = {};
  const storiesByAge: Record<string, number> = {};

  stories.forEach((s: any) => {
    if (!storiesByWeek[s.week_number]) storiesByWeek[s.week_number] = [];
    storiesByWeek[s.week_number].push(s);

    if (s.age_group) {
        storiesByAge[s.age_group] = (storiesByAge[s.age_group] || 0) + 1;
    }
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-gray-100 dark:border-slate-800">
            <DialogTitle className="text-3xl font-extrabold bg-gradient-to-r from-story-purple-600 to-blue-500 bg-clip-text text-transparent">
              {series.name}
            </DialogTitle>
             <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setIsManagerOpen(true)}
            >
                <Settings2 className="h-4 w-4" />
                {t("series.management.manager.title")}
            </Button>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-10 w-10 animate-spin text-story-purple-400" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 pt-4">
                {/* Total Stories Card */}
                <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                       <div className="w-16 h-16 rounded-full bg-purple-400 blur-xl"></div>
                   </div>
                   <p className="text-xs font-semibold text-purple-600/80 dark:text-purple-300 uppercase tracking-wider mb-1">
                      {t("series.management.kpi.totalStories")}
                   </p>
                   <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                      {totalStories}
                   </p>
                </div>
  
                 {/* Weeks Covered Card */}
                <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                       <div className="w-16 h-16 rounded-full bg-blue-400 blur-xl"></div>
                   </div>
                   <p className="text-xs font-semibold text-blue-600/80 dark:text-blue-300 uppercase tracking-wider mb-1">
                      {t("series.management.kpi.weeksCovered")}
                   </p>
                   <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                      {uniqueWeeks.length}
                   </p>
                </div>
  
                {/* Age Groups Card */}
                <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-green-50 to-white dark:from-slate-800 dark:to-slate-900 border border-green-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                   <p className="text-xs font-semibold text-green-600/80 dark:text-green-300 uppercase tracking-wider mb-3">
                      {t("series.management.kpi.ages")}
                   </p>
                   <div className="flex flex-wrap gap-2">
                      {Object.entries(storiesByAge).map(([age, count]) => (
                          <div key={age} className={cn(
                              "flex items-center border rounded px-2 py-1 shadow-sm transition-colors",
                              getAgeGroupColor(age),
                              "bg-opacity-20 border-opacity-30 dark:bg-opacity-30" // Subtle background for container
                          )}>
                              <span className="text-[10px] font-bold mr-1.5 opacity-90">{age}</span>
                              <span className="text-[10px] font-bold bg-white/50 dark:bg-black/20 px-1.5 rounded">{count}</span>
                          </div>
                      ))}
                      {Object.keys(storiesByAge).length === 0 && <span className="text-sm text-gray-400 italic">-</span>}
                   </div>
                </div>
              </div>
  
              {/* Timeline Breakdown - Grid Layout */}
              <div>
                  <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white font-handwriting">
                          {t("series.management.kpi.timelineCoverage")}
                      </h3>
                      <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700"></div>
                  </div>
  
                  {uniqueWeeks.length === 0 && (
                      <div className="text-center py-12 text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                          {t("series.management.kpi.noStories")}
                      </div>
                  )}
  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {uniqueWeeks.map((week: any) => (
                          <div key={week} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full">
                              <div className="flex items-center justify-between mb-3 border-b border-gray-50 dark:border-gray-700 pb-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      {t("series.management.kpi.week")} <span className="text-story-purple text-lg ml-1">{week}</span>
                                  </span>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                                    {storiesByWeek[week].length}
                                  </span>
                              </div>
                              
                              <div className="space-y-2 flex-1">
                                  {storiesByWeek[week]
                                      .sort((a, b) => a.day_order - b.day_order)
                                      .map((story) => (
                                      <div key={story.id} className="flex items-center gap-2 group/item">
                                          <div className="flex items-center justify-center w-5 h-5 rounded bg-gray-50 dark:bg-slate-700 text-[10px] font-bold text-slate-400 border border-gray-100 dark:border-slate-600">
                                              {story.day_order}
                                          </div>
                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate flex-1 group-hover/item:text-story-purple transition-colors" title={story.title}>
                                              {story.title}
                                          </span>
                                          <span 
                                            className={cn(
                                                "text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 border bg-opacity-10 dark:bg-opacity-20",
                                                getAgeGroupColor(story.age_group)
                                            )}
                                          >
                                              {story.age_group}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
  
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <SeriesStoryManagerDialog 
        series={series}
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
      />
    </>
  );
};
