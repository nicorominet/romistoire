import React, { useState } from "react";
import { i18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Settings2, CheckCircle, AlertTriangle } from "lucide-react";
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
  
              {/* Timeline Breakdown - Accordion Layout */}
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
  
                  <Accordion type="single" collapsible className="w-full space-y-3">
                      {uniqueWeeks.map((week: any) => {
                          const weekStories = storiesByWeek[week].sort((a, b) => a.day_order - b.day_order);
                          // Get unique age groups for this week
                          const weekAgeGroups = Array.from(new Set(weekStories.map(s => s.age_group || 'Unknown'))).sort();
                          
                          return (
                          <AccordionItem key={week} value={`week-${week}`} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden px-1">
                              <AccordionTrigger className="px-4 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                  <div className="flex items-center justify-between w-full pr-4">
                                      <span className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                          {t("series.management.kpi.week")} <span className="text-story-purple text-lg ml-1">{week}</span>
                                      </span>
                                      <div className="flex items-center gap-3">
                                          <div className="flex -space-x-1.5">
                                              {weekAgeGroups.map(age => {
                                                  const colorClass = {
                                                      "2-3": "bg-green-400 dark:bg-green-500",
                                                      "4-6": "bg-blue-400 dark:bg-blue-500",
                                                      "7-9": "bg-yellow-400 dark:bg-yellow-500",
                                                      "10-12": "bg-pink-400 dark:bg-pink-500",
                                                      "13-15": "bg-purple-400 dark:bg-purple-500",
                                                      "16-18": "bg-orange-400 dark:bg-orange-500"
                                                  }[age as string] || "bg-slate-400";
                                                  
                                                  return (
                                                      <div key={age} className={cn(
                                                          "w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800",
                                                          colorClass
                                                      )} />
                                                  );
                                              })}
                                          </div>
                                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                            {weekStories.length} {t("series.management.kpi.stories")}
                                          </span>
                                      </div>
                                  </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4 pt-2">
                                  <Tabs defaultValue={weekAgeGroups[0] as string} className="w-full">
                                          <TabsList className="mb-4 flex flex-wrap h-auto bg-slate-50 dark:bg-slate-900/50 p-1">
                                              {weekAgeGroups.map((age) => {
                                                  const count = weekStories.filter(s => (s.age_group || 'Unknown') === age).length;
                                                  const isComplete = count >= 7;
                                                  
                                                  return (
                                                  <TabsTrigger 
                                                      key={age} 
                                                      value={age as string}
                                                      className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-story-purple data-[state=active]:shadow-sm flex items-center gap-1.5"
                                                  >
                                                      {isComplete ? (
                                                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                      ) : (
                                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                      )}
                                                      {age} 
                                                      <span className="opacity-60 text-[10px]">({count})</span>
                                                  </TabsTrigger>
                                              )})}
                                          </TabsList>

                                      {/* If only one age group, don't strictly need tabs but structure helps consistency */}
                                      {weekAgeGroups.map((age) => (
                                          <TabsContent key={age} value={age as string} className="space-y-2 mt-0">
                                              {weekStories
                                                  .filter(s => (s.age_group || 'Unknown') === age)
                                                  .map((story) => (
                                                  <div key={story.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700 group/story">
                                                      <div className="flex items-center justify-center w-6 h-6 rounded bg-white dark:bg-slate-800 text-xs font-bold text-slate-400 border border-slate-100 dark:border-slate-600 shadow-sm">
                                                          {story.day_order}
                                                      </div>
                                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1 group-hover/story:text-story-purple transition-colors">
                                                          {story.title}
                                                      </span>
                                                      <span 
                                                        className={cn(
                                                            "text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 border bg-opacity-10 dark:bg-opacity-20",
                                                            getAgeGroupColor(story.age_group)
                                                        )}
                                                      >
                                                          {story.age_group}
                                                      </span>
                                                  </div>
                                              ))}
                                          </TabsContent>
                                      ))}
                                  </Tabs>
                              </AccordionContent>
                          </AccordionItem>
                      )})}
                  </Accordion>
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
